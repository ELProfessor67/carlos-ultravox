export class RealTimeAudioPlayer {
  
    constructor(setIsAISpeaking) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.audioQueue = []; // Queue for audio chunks
      this.isPlaying = false; // Whether audio is currently being played
      this.setIsAISpeaking = setIsAISpeaking;
    }
  
    // Decode Base64 to ArrayBuffer
    base64ToArrayBuffer(base64) {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }
  
    // Add audio chunk to the queue and play if not already playing
    async addAudioChunk(base64Chunk) {
      const audioData = this.base64ToArrayBuffer(base64Chunk);
      const audioBuffer = await this.audioContext.decodeAudioData(audioData);
  
      // Add to the queue
      this.audioQueue.push(audioBuffer);
  
      // Start playback if not already playing
      if (!this.isPlaying) {
        this.playNextChunk();
      }
    }

    async clearQueChunks(){
      this.audioQueue = [];
    }
    
    // Play the next audio chunk in the queue
    playNextChunk() {
      if (this.audioQueue.length === 0) {
        this.isPlaying = false;
        this.setIsAISpeaking(false);
        return; // Nothing to play
      }
  
      this.isPlaying = true;
      this.setIsAISpeaking(true);
  
      // Get the next audio buffer from the queue
      const buffer = this.audioQueue.shift();
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
  
      // Play the next chunk when this one ends
      source.onended = () => {
        this.playNextChunk();
      };
  
      source.connect(this.audioContext.destination);
      source.start(0);
    }
  }
  