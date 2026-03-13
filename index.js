const API_URL = 'http://lmpss3.dev.spsejecna.net/procedure.php';

let selectedUserId = null;
let drinksList = []; 

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    try {
        await Promise.all([
            fetchUsers(),
            fetchDrinkTypes()
        ]);
        
        loadLastUser();
        
        // Event listener pro odeslání dat po obnovení připojení
        window.addEventListener('online', processOfflineQueue);
        
        // Zkusíme odeslat data hned po načtení (pokud nějaká zbyla z minula)
        processOfflineQueue();

        document.getElementById('save-button').addEventListener('click', saveDrinks);
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

// --- Offline Logic ---

function saveToOfflineQueue(payload) {
    let queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    queue.push({
        payload: payload,
        timestamp: Date.now()
    });
    localStorage.setItem('offlineQueue', JSON.stringify(queue));
    console.log('Data uložena do offline fronty.');
}

async function processOfflineQueue() {
    if (!navigator.onLine) return;

    let queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    if (queue.length === 0) return;

    console.log(`Pokus o odeslání ${queue.length} offline záznamů...`);
    const newQueue = [];

    for (const item of queue) {
        try {
            const response = await fetch(`${API_URL}?cmd=saveDrinks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.payload)
            });

            if (!response.ok) {
                // Pokud server vrátí chybu (např. 500), necháme to ve frontě na později
                throw new Error(`Server error: ${response.status}`);
            }
            console.log('Offline záznam úspěšně odeslán.');
        } catch (error) {
            console.error('Chyba při odesílání offline záznamu:', error);
            // Pokud se to nepovedlo, vrátíme to do nové fronty
            newQueue.push(item);
        }
    }

    if (queue.length > newQueue.length) {
        alert('Data uložená v offline režimu byla úspěšně odeslána.');
    }

    localStorage.setItem('offlineQueue', JSON.stringify(newQueue));
}

// --- Existing Logic ---

function getUserId(user) {
    if (!user) return null;
    if (user.id !== undefined) return user.id;
    if (user.ID !== undefined) return user.ID;
    if (user.user_id !== undefined) return user.user_id;
    return null;
}

function normalizeUsers(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    
    if (typeof data === 'object') {
        return Object.keys(data).map(key => {
            const item = data[key];
            if (typeof item === 'object' && item !== null) {
                if (!getUserId(item)) {
                    item.id = key; 
                }
                return item;
            }
            if (typeof item === 'string') {
                return { id: key, name: item };
            }
            return item;
        });
    }
    return [];
}

async function fetchUsers() {
    try {
        const response = await fetch(`${API_URL}?cmd=getPeopleList`);
        const rawData = await response.json();
        const users = normalizeUsers(rawData);
        renderUsers(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        document.getElementById('users-list').innerHTML = '<p>Chyba při načítání uživatelů (nebo jste offline).</p>';
    }
}

function renderUsers(users) {
    const container = document.getElementById('users-list');
    container.innerHTML = '';

    if (!users || users.length === 0) {
        container.innerHTML = '<p>Žádní uživatelé.</p>';
        return;
    }

    users.forEach(user => {
        if (!user) return;

        const id = getUserId(user);
        const name = user.name || user.login || user.fullname || (user.id ? `User ${user.id}` : 'Unknown');

        if (!id) return;

        const div = document.createElement('div');
        div.className = 'user-card';
        div.textContent = name;
        div.dataset.id = id;
        
        div.onclick = () => selectUser(id);
        container.appendChild(div);
    });
}

function selectUser(id) {
    selectedUserId = id;
    localStorage.setItem('lastUserId', id);
    document.cookie = `lastUserId=${id}; path=/; max-age=31536000`; 

    document.querySelectorAll('.user-card').forEach(card => {
        if (card.dataset.id == id) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
}

async function fetchDrinkTypes() {
    try {
        const response = await fetch(`${API_URL}?cmd=getTypesList`);
        const rawData = await response.json();
        
        let types = [];
        if (Array.isArray(rawData)) {
            types = rawData;
        } else if (typeof rawData === 'object') {
            types = Object.values(rawData);
        }
        
        drinksList = types.map(t => {
            let typeName = '';
            
            if (typeof t === 'string') {
                typeName = t;
            } else if (typeof t === 'object' && t !== null) {
                typeName = t.type || t.name || t.label || t.nazev || t.text;
                
                if (!typeName) {
                    for (const key in t) {
                        const val = t[key];
                        if (typeof val === 'string' && !key.toLowerCase().includes('id') && isNaN(val)) {
                            typeName = val;
                            break;
                        }
                    }
                }
                
                if (!typeName) {
                     const values = Object.values(t);
                     for (const val of values) {
                         if (typeof val === 'string') {
                             typeName = val;
                             break;
                         }
                     }
                }
            }
            
            return {
                type: typeName || 'Neznámý nápoj',
                value: 0
            };
        });
        
        renderDrinks();
    } catch (error) {
        console.error('Error fetching drinks:', error);
        document.getElementById('drinks-list').innerHTML = '<p>Chyba při načítání nápojů (nebo jste offline).</p>';
    }
}

function renderDrinks() {
    const container = document.getElementById('drinks-list');
    container.innerHTML = '';

    drinksList.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'drink-item';

        const name = document.createElement('span');
        name.className = 'drink-name';
        name.textContent = item.type;

        const controls = document.createElement('div');
        controls.className = 'drink-controls';

        const btnMinus = document.createElement('button');
        btnMinus.textContent = '-';
        btnMinus.onclick = () => updateDrink(index, -1);

        const valueDisplay = document.createElement('span');
        valueDisplay.textContent = item.value;
        valueDisplay.id = `drink-val-${index}`;

        const btnPlus = document.createElement('button');
        btnPlus.textContent = '+';
        btnPlus.onclick = () => updateDrink(index, 1);

        controls.append(btnMinus, valueDisplay, btnPlus);
        row.append(name, controls);
        container.appendChild(row);
    });
}

function updateDrink(index, delta) {
    const newValue = drinksList[index].value + delta;
    if (newValue >= 0) {
        drinksList[index].value = newValue;
        document.getElementById(`drink-val-${index}`).textContent = newValue;
    }
}

function loadLastUser() {
    let lastUser = localStorage.getItem('lastUserId');
    
    if (!lastUser) {
        const cookies = document.cookie.split(';');
        for (let c of cookies) {
            if (!c) continue;
            const parts = c.trim().split('=');
            if (parts[0] === 'lastUserId') {
                lastUser = parts[1];
                break;
            }
        }
    }

    if (lastUser) {
        setTimeout(() => {
            const userCard = document.querySelector(`.user-card[data-id="${lastUser}"]`);
            if (userCard) {
                selectUser(lastUser);
            }
        }, 200);
    }
}

async function saveDrinks() {
    if (!selectedUserId) {
        alert('Vyberte prosím uživatele!');
        return;
    }

    const payloadDrinks = drinksList.map(d => ({
        type: d.type,
        value: d.value
    }));

    const payload = {
        user: selectedUserId,
        drinks: payloadDrinks
    };

    console.log('Sending payload:', payload);

    // Pokud jsme offline rovnou
    if (!navigator.onLine) {
        saveToOfflineQueue(payload);
        alert('Jste offline. Data byla uložena a odešlou se po připojení k internetu.');
        resetDrinks();
        return;
    }

    try {
        const response = await fetch(`${API_URL}?cmd=saveDrinks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert('Uloženo!');
            resetDrinks();
        } else {
            // Server error (např. 500)
            throw new Error(`Server returned ${response.status}`);
        }
    } catch (error) {
        console.error('Save error:', error);
        // Pokud fetch selže (síťová chyba), uložíme do offline
        saveToOfflineQueue(payload);
        alert('Nepodařilo se odeslat data. Uloženo lokálně, zkusíme to později.');
        resetDrinks();
    }
}

function resetDrinks() {
    drinksList.forEach(d => d.value = 0);
    renderDrinks();
}
