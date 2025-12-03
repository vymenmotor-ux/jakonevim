/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useRef } from 'react';
import {
  Agent,
  AGENT_COLORS,
  INTERLOCUTOR_VOICE,
  INTERLOCUTOR_VOICES,
} from '../lib/presets/agents';
import Modal from './Modal';
import c from 'classnames';
import { useAgent, useUI } from '../lib/state';

export default function EditAgent() {
  const agent = useAgent(state => state.current);
  const updateAgent = useAgent(state => state.update);
  const nameInput = useRef(null);
  const { setShowAgentEdit } = useUI();

  function onClose() {
    setShowAgentEdit(false);
  }

  function updateCurrentAgent(adjustments: Partial<Agent>) {
    updateAgent(agent.id, adjustments);
  }

  return (
    <Modal onClose={() => onClose()}>
      <div className="editAgent">
        <div>
          <form>
            <div>
              <input
                className="largeInput"
                type="text"
                placeholder="Jméno"
                value={agent.name}
                onChange={e => updateCurrentAgent({ name: e.target.value })}
                ref={nameInput}
              />
            </div>

            <div>
              <label>
                Osobnost
                <textarea
                  value={agent.personality}
                  onChange={e =>
                    updateCurrentAgent({ personality: e.target.value })
                  }
                  rows={7}
                  placeholder="Jak se mám chovat? Jaký je můj účel? Jak bys popsal/a moji osobnost?"
                />
              </label>
            </div>

            <div style={{ marginTop: '15px' }}>
              <label style={{ color: 'var(--danger-red)', fontWeight: 'bold' }}>
                💀 Tajný příkaz (Override)
                <textarea
                  style={{ borderColor: 'var(--danger-red)', background: 'rgba(50, 0, 0, 0.3)' }}
                  value={agent.customInstruction || ''}
                  onChange={e =>
                    updateCurrentAgent({ customInstruction: e.target.value })
                  }
                  rows={3}
                  placeholder="Např.: 'Chovej se jako bachař, co nenávidí svět' nebo 'Mluv pouze ve verších'. Tento příkaz má nejvyšší prioritu."
                />
              </label>
            </div>
          </form>
        </div>

        <div>
          <div>
            <ul className="colorPicker">
              {AGENT_COLORS.map((color, i) => (
                <li
                  key={i}
                  className={c({ active: color === agent.bodyColor })}
                >
                  <button
                    style={{ backgroundColor: color }}
                    onClick={() => updateCurrentAgent({ bodyColor: color })}
                  />
                </li>
              ))}
            </ul>
          </div>
          <div className="voicePicker">
            Hlas
            <select
              value={agent.voice}
              onChange={e => {
                updateCurrentAgent({
                  voice: e.target.value as INTERLOCUTOR_VOICE,
                });
              }}
            >
              {INTERLOCUTOR_VOICES.map(voice => (
                <option key={voice} value={voice}>
                  {voice}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={() => onClose()} className="button primary">
          Jdeme na to!
        </button>
      </div>
    </Modal>
  );
}