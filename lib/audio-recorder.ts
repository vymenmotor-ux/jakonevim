/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { audioContext } from './utils';
import AudioRecordingWorklet from './worklets/audio-processing';
import VolMeterWorket from './worklets/vol-meter';

import { createWorketFromSrc } from './audioworklet-registry';
import EventEmitter from 'eventemitter3';

function arrayBufferToBase64(buffer: ArrayBuffer) {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

type AudioRecorderEvents = {
  data: [string];
  volume: [number];
};

export class AudioRecorder extends EventEmitter<AudioRecorderEvents> {
  // Explicitly declare inherited methods to satisfy TypeScript
  declare on: EventEmitter<AudioRecorderEvents>['on'];
  declare off: EventEmitter<AudioRecorderEvents>['off'];
  declare emit: EventEmitter<AudioRecorderEvents>['emit'];

  stream: MediaStream | undefined;
  audioContext: AudioContext | undefined;
  source: MediaStreamAudioSourceNode | undefined;
  recording: boolean = false;
  recordingWorklet: AudioWorkletNode | undefined;
  vuWorklet: AudioWorkletNode | undefined;
  
  // Circular Buffer for Echo Terror
  private historyBuffer: Float32Array;
  private writeIndex: number = 0;
  private readonly historyDuration = 5; // Store last 5 seconds
  
  private starting: Promise<void> | null = null;

  constructor(public sampleRate = 16000) {
    super(); // Call super() to initialize EventEmitter
    // Initialize circular buffer
    this.historyBuffer = new Float32Array(sampleRate * this.historyDuration);
  }

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Could not request user media');
    }

    this.starting = new Promise(async (resolve, reject) => {
      try {
        // Request audio with echo cancellation to avoid hearing itself
        // But disable noiseSuppression and autoGainControl to save CPU (fixes stuttering)
        this.stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
             echoCancellation: true,
             noiseSuppression: false, 
             autoGainControl: false 
          } 
        });
        
        this.audioContext = await audioContext({ sampleRate: this.sampleRate });
        this.source = this.audioContext.createMediaStreamSource(this.stream);

        const workletName = 'audio-recorder-worklet';
        const src = createWorketFromSrc(workletName, AudioRecordingWorklet);

        await this.audioContext.audioWorklet.addModule(src);
        this.recordingWorklet = new AudioWorkletNode(
          this.audioContext,
          workletName
        );

        this.recordingWorklet.port.onmessage = async (ev: MessageEvent) => {
          // Worklet processes recording floats and messages converted buffer
          const arrayBuffer = ev.data.data.int16arrayBuffer;

          if (arrayBuffer) {
            // 1. Emit to API
            const arrayBufferString = arrayBufferToBase64(arrayBuffer);
            this.emit('data', arrayBufferString);
            
            // 2. Store in Circular Buffer (Convert Int16 back to Float32 for local playback)
            const dataView = new DataView(arrayBuffer);
            const len = arrayBuffer.byteLength / 2;
            for (let i = 0; i < len; i++) {
                const sample = dataView.getInt16(i * 2, true) / 32768;
                this.historyBuffer[this.writeIndex] = sample;
                this.writeIndex = (this.writeIndex + 1) % this.historyBuffer.length;
            }
          }
        };
        this.source.connect(this.recordingWorklet);

        // vu meter worklet
        const vuWorkletName = 'vu-meter';
        await this.audioContext.audioWorklet.addModule(
          createWorketFromSrc(vuWorkletName, VolMeterWorket)
        );
        this.vuWorklet = new AudioWorkletNode(this.audioContext, vuWorkletName);
        this.vuWorklet.port.onmessage = (ev: MessageEvent) => {
          this.emit('volume', ev.data.volume);
        };

        this.source.connect(this.vuWorklet);
        this.recording = true;
        resolve();
      } catch (error) {
        console.error("Error starting audio recorder", error);
        reject(error);
      } finally {
        this.starting = null;
      }
    });
  }
  
  /**
   * Retrieves the last X seconds of recorded audio from the circular buffer.
   * Used for the "Echo Terror" effect.
   */
  getLastAudio(durationSeconds: number = 3): Float32Array {
      const samplesToRead = Math.min(Math.floor(durationSeconds * this.sampleRate), this.historyBuffer.length);
      const result = new Float32Array(samplesToRead);
      
      // Calculate start index (moving backwards from current writeIndex)
      let readIndex = this.writeIndex - samplesToRead;
      if (readIndex < 0) readIndex += this.historyBuffer.length;
      
      for (let i = 0; i < samplesToRead; i++) {
          result[i] = this.historyBuffer[readIndex];
          readIndex = (readIndex + 1) % this.historyBuffer.length;
      }
      
      return result;
  }

  stop() {
    const handleStop = () => {
      this.source?.disconnect();
      this.stream?.getTracks().forEach(track => track.stop());
      this.stream = undefined;
      this.recordingWorklet = undefined;
      this.vuWorklet = undefined;
      this.recording = false;
    };
    if (this.starting) {
      this.starting.then(handleStop);
      return;
    }
    handleStop();
  }
}