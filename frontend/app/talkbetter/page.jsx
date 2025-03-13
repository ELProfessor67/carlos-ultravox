'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, PhoneOff, MoreVertical } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation';
import { audioContext, base64ToArrayBuffer } from '@/utils/utils';
import { AudioStreamer } from '@/services/audioStreamer';
import VolMeterWorket from '@/services/workers/volMeter';
import AudioPulse from '@/components/AudioPulse';

const App = () => {
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [state, setState] = useState('Connection...');
  const websocketRef = useRef();
  const audioStreamerRef = useRef(null);
  const router = useRouter();
  const streamRef = useRef(null);
  const [volume, setVolume] = useState(0);
  const searchParams = useSearchParams();
  const botname = searchParams.get('name');
  const audioRef = useRef(null)



  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        if (isMuted) {
          audioTrack.enabled = true;
          setIsMuted(false);
        } else {
          audioTrack.enabled = false;
          setIsMuted(true);
        }
      }
    }
  }, [isMuted])

  const endCall = useCallback(() => {
    websocketRef.current?.close();
    audioStreamerRef.current?.stop();
    streamRef.current.getTracks().forEach(track => track.stop());
    router.push('/');
  }, []);


  const onConnect = useCallback(() => {
    console.log('connected')
    setState("Connected")
    const data = {
      event: 'start',
      start: {
        user: {
          name: "Manan Rajpout",
        }
      }
    }
    websocketRef.current.send(JSON.stringify(data));
    setTimeout(() => sendStream(), 4000);
  }, []);



  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: "audio-out" }).then((audioCtx) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx, setIsAISpeaking);
        audioStreamerRef.current
          .addWorklet("vumeter-out", VolMeterWorket, (ev) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            console.log('successfully initialize');
          });
      });
    }
  }, [audioStreamerRef]);


  useEffect(() => {
    if (websocketRef.current) return;
    audioRef.current = new Audio();
    const ws = new WebSocket(process.env.NEXT_PUBLIC_MEDIA_SERVER_URL);
    websocketRef.current = ws;
    ws.onopen = onConnect;
    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      switch (data.event) {
        case 'media':

          const base64Audio = data.media.payload;
          const buffer = base64ToArrayBuffer(base64Audio);
          console.log(buffer.byteLength)
          audioStreamerRef.current?.addPCM16(new Uint8Array(buffer));
          break;
      }
    };

    ws.onclose = () => {
      console.log('close');
    }
  }, []);

  const sendStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const audioContext = new AudioContext({ sampleRate: 8000 }); // Set to 8000 Hz
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const outputData = new Int16Array(inputData.length);

      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
      }

      // Convert Int16Array to Base64
      const uint8Array = new Uint8Array(outputData.buffer);
      const base64String = btoa(String.fromCharCode(...uint8Array));

      if (websocketRef.current.readyState === WebSocket.OPEN) {
        const message = {
          event: "media",
          media: {
            payload: base64String
          }
        };
        websocketRef.current.send(JSON.stringify(message));
      }
    };
  };


  return (
    <>
      <div className="flex flex-col h-screen bg-gradient-to-br from-indigo-100 to-purple-100">
        {/* Main Content */}
        <main className="flex-1 container mx-auto p-4 flex flex-col items-center justify-center">
          {/* AI Assistant and Audio Visualizer */}
          <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center justify-center space-y-6 w-full max-w-2xl">
            <div className='h-[5rem] w-[5rem] bg-gray-700 grid place-items-center rounded-full'><AudioPulse volume={volume} active={false} hover={false}/></div>
            <h2 className="text-2xl font-semibold text-indigo-700">{botname || "Genagents"}</h2>
            <h2 className="text-xl font-normal text-red-600">{state}</h2>
          </div>
        </main>

        {/* Control Bar */}
        <div className="bg-white shadow-lg p-4">
          <div className="container mx-auto flex justify-center items-center space-x-6">
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full ${isMuted ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'
                } hover:opacity-80 transition-opacity`}
            >
              {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <button
              onClick={endCall}
              className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              <PhoneOff size={24} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
