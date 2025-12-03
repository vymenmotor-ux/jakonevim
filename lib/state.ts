/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Agent,
  defaultPresets,
  Karel,
} from './presets/agents';

/**
 * User & Stalker Database
 */
export type User = {
  name?: string;
  info?: string;
  visitCount: number;
  lastSeen: string | null;
  leverage: string[]; // Persisted list of facts/secrets gathered about the user
};

export const useUser = create<
  {
    setName: (name: string) => void;
    setInfo: (info: string) => void;
    registerVisit: () => void;
    addLeverage: (fact: string) => void;
  } & User
>()(
  persist(
    (set, get) => ({
      name: '',
      info: '',
      visitCount: 0,
      lastSeen: null,
      leverage: [],
      
      setName: name => set({ name }),
      setInfo: info => set({ info }),
      
      registerVisit: () => {
        const now = new Date().toISOString();
        // Only increment if it's been at least 1 minute since last visit to avoid refresh spam
        const last = get().lastSeen;
        const shouldIncrement = !last || (new Date(now).getTime() - new Date(last).getTime() > 60000);
        
        if (shouldIncrement) {
            set(state => ({ 
                visitCount: state.visitCount + 1,
                lastSeen: now
            }));
        } else {
            set({ lastSeen: now });
        }
      },

      addLeverage: (fact: string) => {
        const current = get().leverage;
        // Deduplicate logic: simple check if string exists
        if (!current.includes(fact)) {
            set({ leverage: [...current, fact] });
        }
      }
    }),
    {
      name: 'user-storage-v5-leverage', // Bumped version to ensure fresh schema or migration
    }
  )
);

/**
 * UI & Chaos State
 */
export const useUI = create<{
  showUserConfig: boolean;
  setShowUserConfig: (show: boolean) => void;
  showAgentEdit: boolean;
  setShowAgentEdit: (show: boolean) => void;
  
  // Poltergeist / Chaos Modes - State maintained but effects are disabled for performance
  isInverted: boolean;
  isStrobing: boolean;
  setChaos: (type: 'invert' | 'strobe' | 'reset', value?: boolean) => void;
}>(set => ({
  showUserConfig: true,
  setShowUserConfig: (show: boolean) => set({ showUserConfig: show }),
  showAgentEdit: false,
  setShowAgentEdit: (show: boolean) => set({ showAgentEdit: show }),

  isInverted: false, // Visual effect disabled, state kept for potential future use
  isStrobing: false, // Visual effect disabled, state kept for potential future use
  setChaos: (type, value) => {
      // Visual effects are disabled for performance, so these calls are effectively no-ops
      // for actual visual changes, but can still be used for internal logic or logging.
      console.debug(`Chaos effect '${type}' requested, but visual effects are disabled.`);
      if (type === 'reset') return { isInverted: false, isStrobing: false };
      // State can still be updated, but won't manifest visually
      // if (type === 'invert') return { isInverted: value ?? !state.isInverted };
      // if (type === 'strobe') return { isStrobing: value ?? !state.isStrobing };
      return {}; // Return empty to indicate no visual state change
  }
}));

/**
 * Agents
 */
export const useAgent = create<{
  current: Agent;
  availablePresets: Agent[];
  availablePersonal: Agent[];
  setCurrent: (agent: Agent | string) => void;
  addAgent: (agent: Agent) => void;
  update: (agentId: string, adjustments: Partial<Agent>) => void;
}>()(
  persist(
    (set, get) => ({
      current: Karel, 
      availablePresets: defaultPresets,
      availablePersonal: [],

      addAgent: (agent: Agent) => {
        set(state => ({
          availablePersonal: [...state.availablePersonal, agent],
          current: agent,
        }));
      },
      setCurrent: (agent: Agent | string) => {
        const state = get();
        const nextAgent = typeof agent === 'string' 
          ? (state.availablePersonal.find(a => a.id === agent) || state.availablePresets.find(a => a.id === agent)) 
          : agent;

        if (nextAgent) {
          set({ current: nextAgent });
        }
      },
      update: (agentId: string, adjustments: Partial<Agent>) => {
        set(state => {
          const updateList = (list: Agent[]) => list.map(a => a.id === agentId ? { ...a, ...adjustments } : a);
          
          const updatedPresets = updateList(state.availablePresets);
          const updatedPersonal = updateList(state.availablePersonal);
          
          const current = state.current.id === agentId ? { ...state.current, ...adjustments } : state.current;

          return {
            availablePresets: updatedPresets,
            availablePersonal: updatedPersonal,
            current
          };
        });
      },
    }),
    {
      name: 'agent-storage-v5-enhanced',
      partialize: (state) => ({
        availablePersonal: state.availablePersonal,
        current: state.current,
      }),
    }
  )
);