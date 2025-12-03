/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import Modal from './Modal';
import { useUI, useUser } from '../lib/state';

export default function UserSettings() {
  const { name, info, setName, setInfo } = useUser();
  const { setShowUserConfig } = useUI();

  function updateClient() {
    setShowUserConfig(false);
  }

  return (
    <Modal onClose={() => setShowUserConfig(false)}>
      <div className="userSettings">
        <p>
          Tohle je nástroj na testování a design vlastních AI entit. 
          Vše co řekneš, může být (a bude) použito proti tobě.
        </p>

        <form
          onSubmit={e => {
            e.preventDefault();
            setShowUserConfig(false);
            updateClient();
          }}
        >
          <p>Přidání těchto informací udělá zážitek horším (pro tebe):</p>

          <div>
            <p>Tvoje jméno (nebo přezdívka)</p>
            <input
              type="text"
              name="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jak tě máme oslovovat?"
            />
          </div>

          <div>
            <p>Tvoje slabiny a tajemství</p>
            <textarea
              rows={3}
              name="info"
              value={info}
              onChange={e => setInfo(e.target.value)}
              placeholder="Čeho se bojíš? Za co se stydíš? Jaké jsou tvé nejistoty? Všechno to použijeme proti tobě."
            />
          </div>

          <button className="button primary">Uložit a trpět</button>
        </form>
      </div>
    </Modal>
  );
}