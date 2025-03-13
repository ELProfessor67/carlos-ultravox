from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from settings import PORT
import asyncio
from services.ultravoxservice import create_ultravox_call
import json
import websockets
import traceback
import base64
import audioop
from fastapi.middleware.cors import CORSMiddleware
from constant.constant import system_promt
app = FastAPI()


origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Keep the same session store
sessions = {}
LOG_EVENT_TYPES = [
    'response.content.done',
    'response.done',
    'session.created',
    'conversation.item.input_audio_transcription.completed'
]

def get_required_params(data, tool_name):
    for item in data:
        if item["modelToolName"] == tool_name:
            return [param["name"] for param in item["dynamicParameters"] if param.get("required", False)]
    return []

#root route
@app.get("/")
async def root():
    return {"message": "Twilio + Ultravox Media Stream Server is running!"}


#handle web call
@app.websocket("/web-media-stream")
async def media_stream_web(websocket: WebSocket):
    """
        Handles the  WebSocket and connects to Ultravox via WebSocket.
    """
    await websocket.accept()
    print('Client connected to /web-media-stream (Web)')

    # Initialize session variables
    call_sid = None
    session = None
    stream_sid = ''
    uv_ws = None  # Ultravox WebSocket connection

    config = {
        "call_sid": None,
        "session": None,
        "stream_sid": "",
        "uv_ws": None
    }

    # Define handler for Ultravox messages
    async def handle_ultravox(config):
        nonlocal uv_ws, session, stream_sid, call_sid
        try:
            async for raw_message in config["uv_ws"]:
                if isinstance(raw_message, bytes):
                    # Agent audio in PCM s16le
                    try:
                        mu_law_bytes = audioop.lin2ulaw(raw_message, 2)
                        pcm_bytes = audioop.ulaw2lin(mu_law_bytes,2)
                        payload_base64 = base64.b64encode(pcm_bytes).decode('ascii')
                    except Exception as e:
                        print(f"Error transcoding PCM to µ-law: {e}")
                        continue  # Skip this audio frame

                    # Send to Twilio as media payload
                    try:
                        await websocket.send_text(json.dumps({
                            "event": "media",
                            "streamSid": config["stream_sid"],
                            "media": {
                                "payload": payload_base64
                            }
                        }))
                    except Exception as e:
                        print(f"Error sending media to Twilio: {e}")

                else:
                    # Text data message from Ultravox
                    try:
                        msg_data = json.loads(raw_message)
                        # print(f"Received data message from Ultravox: {json.dumps(msg_data)}")
                    except Exception as e:
                        print(f"Ultravox non-JSON data: {raw_message}")
                        continue

                    msg_type = msg_data.get("type") or msg_data.get("eventType")

                    if msg_type == "transcript":
                        role = msg_data.get("role")
                        text = msg_data.get("text") or msg_data.get("delta")
                        final = msg_data.get("final", False)

                        if role and text:
                            role_cap = role.capitalize()
                            print(f"{role_cap} says: {text}")

                            if final:
                                print(f"Transcript for {role_cap} finalized.")

                    elif msg_type == "client_tool_invocation":
                        toolName = msg_data.get("toolName", "")
                        invocationId = msg_data.get("invocationId")
                        parameters = msg_data.get("parameters", {})
                        print(f"Invoking tool: {toolName} with invocationId: {invocationId} and parameters: {parameters}")

                    elif msg_type == "state":
                        # Handle state messages
                        state = msg_data.get("state")
                        if state:
                            print(f"Agent state: {state}")

                    elif msg_type == "debug":
                        # Handle debug messages
                        debug_message = msg_data.get("message")
                        print(f"Ultravox debug message: {debug_message}")
                        # Attempt to parse nested messages within the debug message
                        try:
                            nested_msg = json.loads(debug_message)
                            nested_type = nested_msg.get("type")

                            if nested_type == "toolResult":
                                tool_name = nested_msg.get("toolName")
                                output = nested_msg.get("output")
                                print(f"Tool '{tool_name}' result: {output}")


                            else:
                                print(f"Unhandled nested message type within debug: {nested_type}")
                        except json.JSONDecodeError as e:
                            print(f"Failed to parse nested message within debug message: {e}. Message: {debug_message}")

                    elif msg_type in LOG_EVENT_TYPES:
                        print(f"Ultravox event: {msg_type} - {msg_data}")
                    else:
                        print(f"Unhandled Ultravox message type: {msg_type} - {msg_data}")

        except Exception as e:
            print(f"Error in handle_ultravox: {e}")
            traceback.print_exc()

    # Define handler for Twilio messages
    async def handle_twilio():
       
        try:
            while True:
                message = await websocket.receive_text()
                data = json.loads(message)

                if data.get('event') == 'start':
                    print("Start Call")
                    # Extract first_message and caller_number
                    first_message =  "Hello"


                    # Create Ultravox call with first_message
                    uv_join_url = await create_ultravox_call(
                        system_prompt=system_promt,
                        first_message=first_message,
                    )

                    if not uv_join_url:
                        print("Ultravox joinUrl is empty. Cannot establish WebSocket connection.")
                        await websocket.close()
                        return

                    # Connect to Ultravox WebSocket
                    try:
                        config["uv_ws"] = await websockets.connect(uv_join_url)
                        print("Ultravox WebSocket connected.")
                    except Exception as e:
                        print(f"Error connecting to Ultravox WebSocket: {e}")
                        traceback.print_exc()
                        await websocket.close()
                        return

                    # Start handling Ultravox messages as a separate task
                    uv_task = asyncio.create_task(handle_ultravox(config))
                    print("Started Ultravox handler task.")

                elif data.get('event') == 'media':
                    # Twilio sends media from user
                    payload_base64 = data['media']['payload']

                    try:
                        # Decode base64 to get raw µ-law bytes
                        pcm_bytes_raw = base64.b64decode(payload_base64)

                    except Exception as e:
                        print(f"Error decoding base64 payload: {e}")
                        continue  # Skip this payload

                    try:
                        # Transcode µ-law to PCM (s16le)
                        ulaw_bytes = audioop.lin2ulaw(pcm_bytes_raw, 2)
                        pcm_bytes = audioop.ulaw2lin(ulaw_bytes,2)
                        
                    except Exception as e:
                        print(f"Error transcoding µ-law to PCM: {e}")
                        continue  # Skip this payload

                    # Send PCM bytes to Ultravox
                    if config["uv_ws"] and config["uv_ws"].state == websockets.protocol.State.OPEN:
                        try:
                            await config["uv_ws"].send(pcm_bytes)
                       
                        except Exception as e:
                            print(f"Error sending PCM to Ultravox: {e}")

        except WebSocketDisconnect:
            print(f"Twilio WebSocket disconnected")
            
            # Attempt to close Ultravox ws
            if config["uv_ws"] and config["uv_ws"].state == websockets.protocol.State.OPEN:
                await config["uv_ws"].close()

        except Exception as e:
            print(f"Error in handle_twilio: {e}")
            traceback.print_exc()

    # Start handling Twilio media as a separate task
    twilio_task = asyncio.create_task(handle_twilio())

    # Wait for the Twilio handler to complete
    await twilio_task



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)