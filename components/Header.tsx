/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useLiveAPIContext } from '../contexts/LiveAPIContext';
import { Agent, createNewAgent } from '../lib/presets/agents';
import { useAgent, useUI, useUser } from '../lib/state';
import c from 'classnames';
import { useEffect, useState } from 'react';

export default function Header() {
  const { showUserConfig, setShowUserConfig, setShowAgentEdit } = useUI();
  const { name } = useUser();
  const { current, setCurrent, availablePresets, availablePersonal, addAgent } =
    useAgent();
  const { disconnect } = useLiveAPIContext();

  let [showRoomList, setShowRoomList] = useState(false);

  useEffect(() => {
    const hideRoomList = () => setShowRoomList(false);
    window.addEventListener('click', hideRoomList);
    return () => window.removeEventListener('click', hideRoomList);
  }, []);

  function changeAgent(agent: Agent | string) {
    disconnect();
    setCurrent(agent);
  }

  function addNewChatterBot() {
    disconnect();
    addAgent(createNewAgent());
    setShowAgentEdit(true);
  }

  return (
    <header>
      <div className="roomInfo">
        <div className="roomName">
          <button
            onClick={e => {
              e.stopPropagation();
              setShowRoomList(!showRoomList);
            }}
            title="Vybrat bota"
          >
            <span className="icon material-symbols-outlined">smart_toy</span>
            {current.name}
            <span className="icon material-symbols-outlined">expand_more</span>
          </button>
        </div>

        <div className={c('roomList', { active: showRoomList })}>
          <div>
            <h3>SYSTEM PRESETS</h3>
            <ul>
              {availablePresets
                .filter(agent => agent.id !== current.id)
                .map(agent => (
                  <li
                    key={agent.name}
                    className={c({ active: agent.id === current.id })}
                  >
                    <button onClick={() => changeAgent(agent)}>
                      {agent.name}
                    </button>
                  </li>
                ))}
            </ul>
          </div>

          <div>
            <h3>USER MODELS</h3>
            {
              <ul>
                {availablePersonal.length ? (
                  availablePersonal.map(({ id, name }) => (
                    <li key={name} className={c({ active: id === current.id })}>
                      <button onClick={() => changeAgent(id)}>{name}</button>
                    </li>
                  ))
                ) : (
                  <p style={{color: '#555', fontSize: '0.7rem', padding: '10px'}}>NO CUSTOM MODELS</p>
                )}
              </ul>
            }
            <button
              className="newRoomButton"
              onClick={() => {
                addNewChatterBot();
              }}
              style={{ borderTop: '1px solid #333', color: 'var(--primary-cyan)', fontWeight: 'bold', marginTop: '5px' }}
            >
              + CREATE NEW ENTITY
            </button>
          </div>
        </div>
      </div>

      <div className="header-controls">
        <button
            onClick={() => setShowAgentEdit(true)}
            className="header-btn"
            title="Editovat nastavení bota"
        >
            <span className="icon material-symbols-outlined">tune</span>
            <span className="btn-label">CONFIG</span>
        </button>
        
        <button
            className="header-btn"
            onClick={() => setShowUserConfig(!showUserConfig)}
            title="Nastavení uživatele"
        >
            <span className="icon material-symbols-outlined">account_circle</span>
            <span className='user-name'>{name || 'USER'}</span>
        </button>
      </div>
    </header>
  );
}