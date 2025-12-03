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

import { AmbienceType, VoiceEffect } from './presets/agents';

export class AudioStreamer {
  private sampleRate: number = 24000;
  // Sníženo z 4096 na 2048 pro rychlejší odezvu (nižší latence)
  private bufferSize: number = 2048; 
  private audioQueue: Float32Array[] = [];
  private isPlaying: boolean = false;
  private scheduledTime: number = 0;
  
  public gainNode: GainNode;
  public analyser: AnalyserNode;
  public masterBus: GainNode;
  private ambienceGain: GainNode;

  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private scheduleTimeoutId: number | null = null;

  public onComplete = () => {};

  constructor(public context: AudioContext) {
    this.gainNode = this.context.createGain();
    this.masterBus = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.5;

    this.ambienceGain = this.context.createGain();
    this.ambienceGain.gain.value = 0;
    this.ambienceGain.connect(this.masterBus); 

    this.masterBus.connect(this.gainNode); 
    this.masterBus.connect(this.analyser);
    this.gainNode.connect(this.context.destination);

    this.addPCM16 = this.addPCM16.bind(this);
    this.processQueue = this.processQueue.bind(this);
  }

  setAmbience(type: AmbienceType) {
      this.ambienceGain.gain.value = 0;
  }

  setEffect(effect: VoiceEffect) {
    // Disabled
  }

  private _processPCM16Chunk(chunk: Uint8Array): Float32Array {
    const float32Array = new Float32Array(chunk.length / 2);
    const dataView = new DataView(chunk.buffer);

    for (let i = 0; i < chunk.length / 2; i++) {
      try {
        const int16 = dataView.getInt16(i * 2, true);
        float32Array[i] = int16 / 32768;
      } catch (e) {
        console.error(e);
      }
    }
    return float32Array;
  }

  addPCM16(chunk: Uint8Array) {
    let processingBuffer = this._processPCM16Chunk(chunk);
    
    // Chunkování příchozích dat
    while (processingBuffer.length >= this.bufferSize) {
      const buffer = processingBuffer.slice(0, this.bufferSize);
      this.audioQueue.push(buffer);
      processingBuffer = processingBuffer.slice(this.bufferSize);
    }
    
    if (processingBuffer.length > 0) {
      this.audioQueue.push(processingBuffer);
    }
    
    // Pokud nehrajeme, nastartujeme scheduler
    if (!this.isPlaying) {
      this.isPlaying = true;
      if (this.context.state === 'suspended') {
        this.context.resume();
      }
      // Reset času, pokud jsme pozadu. Sníženo z 0.05 na 0.02 pro rychlejší nástup.
      this.scheduledTime = Math.max(this.context.currentTime + 0.02, this.scheduledTime);
      this.processQueue();
    }
  }

  private createAudioBuffer(audioData: Float32Array): AudioBuffer {
    const audioBuffer = this.context.createBuffer(
      1,
      audioData.length,
      this.sampleRate
    );
    audioBuffer.getChannelData(0).set(audioData);
    return audioBuffer;
  }

  // Lookahead Scheduler Pattern
  private processQueue() {
    // Pokud jsme zastaveni, neplánujeme
    if (!this.isPlaying) return;

    // Časové okno, do kterého plánujeme. Sníženo z 0.2 na 0.1 pro těsnější scheduling.
    const LOOKAHEAD_TIME = 0.1;
    // Interval kontroly (tikáme každých 20ms - rychleji)
    const TICK_INTERVAL = 20;

    // Pokud se scheduledTime propadl do minulosti (kvůli lagu), posuneme ho na přítomnost
    if (this.scheduledTime < this.context.currentTime) {
        this.scheduledTime = this.context.currentTime;
    }

    // Dokud máme data a plánovací kurzor je v rámci našeho okna...
    while (
      this.audioQueue.length > 0 &&
      this.scheduledTime < this.context.currentTime + LOOKAHEAD_TIME
    ) {
      const audioData = this.audioQueue.shift()!;
      const audioBuffer = this.createAudioBuffer(audioData);
      const source = this.context.createBufferSource();
      
      source.buffer = audioBuffer;
      source.connect(this.masterBus);

      source.onended = () => {
        this.activeSources.delete(source);
        if (this.audioQueue.length === 0 && this.activeSources.size === 0) {
            this.onComplete();
        }
      };

      this.activeSources.add(source);
      
      // Naplánujeme na přesný čas
      source.start(this.scheduledTime);
      
      // Posuneme kurzor o délku bufferu
      this.scheduledTime += audioBuffer.duration;
    }

    // Pokud fronta došla, ale stále hrajeme, prostě čekáme na další data (isPlaying zůstává true).
    
    if (this.scheduleTimeoutId) {
        clearTimeout(this.scheduleTimeoutId);
    }

    // Pevný tick pro stabilitu smyčky
    this.scheduleTimeoutId = window.setTimeout(this.processQueue, TICK_INTERVAL);
  }

  playBuffer(audioData: Float32Array, sampleRate: number, playbackRate: number = 1.0) {
      if (this.context.state === 'suspended') {
          this.context.resume();
      }

      const buffer = this.context.createBuffer(1, audioData.length, sampleRate);
      buffer.getChannelData(0).set(audioData);
      
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate; 
      
      source.connect(this.masterBus);
      
      source.start();
      this.activeSources.add(source);
      source.onended = () => this.activeSources.delete(source);
  }

  interrupt() {
    // Okamžité zastavení všeho
    this.isPlaying = false;
    this.audioQueue = [];

    if (this.scheduleTimeoutId) {
      clearTimeout(this.scheduleTimeoutId);
      this.scheduleTimeoutId = null;
    }

    for (const source of this.activeSources) {
      source.onended = null;
      try {
        source.stop();
      } catch (e) {}
      source.disconnect();
    }
    this.activeSources.clear();
    
    // Reset času na teď, abychom při dalším spuštění nezačali v minulosti
    this.scheduledTime = this.context.currentTime;
  }

  stop() {
    this.interrupt();
    
    this.gainNode.gain.cancelScheduledValues(this.context.currentTime);
    this.gainNode.gain.setValueAtTime(
      this.gainNode.gain.value,
      this.context.currentTime
    );
    this.gainNode.gain.linearRampToValueAtTime(
      0,
      this.context.currentTime + 0.05
    );
  }

  async resume() {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    this.interrupt(); // Clear previous state
    this.gainNode.gain.setValueAtTime(1, this.context.currentTime);
  }

  complete() {
    // Manual complete trigger if needed
    if (this.audioQueue.length === 0 && this.activeSources.size === 0) {
      this.onComplete();
    }
  }
}