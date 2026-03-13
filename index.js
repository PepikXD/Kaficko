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
        
        document.getElementById('save-button').addEventListener('click', saveDrinks);
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

// Funkce pro získání ID z objektu uživatele
function getUserId(user) {
    if (!user) return null;
    if (user.id !== undefined) return user.id;
    if (user.ID !== undefined) return user.ID;
    if (user.user_id !== undefined) return user.user_id;
    return null;
}

// Funkce pro převod dat z API na pole, se zachováním klíčů jako ID
function normalizeUsers(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    
    if (typeof data === 'object') {
        return Object.keys(data).map(key => {
            const item = data[key];
            if (typeof item === 'object' && item !== null) {
                // Pokud objekt nemá ID, přidáme mu ho z klíče
                if (!getUserId(item)) {
                    item.id = key; 
                }
                return item;
            }
            // Pokud je to jen string (jméno) a klíč je ID
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
        document.getElementById('users-list').innerHTML = '<p>Chyba při načítání uživatelů.</p>';
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

        if (!id) return; // Bez ID nemůžeme uživatele vybrat

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
        
        // Normalizace pro drinky
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
                // Zkusíme najít název v běžných vlastnostech
                typeName = t.type || t.name || t.label || t.nazev || t.text;
                
                // Pokud stále nemáme název, zkusíme najít první string, který nevypadá jako ID
                if (!typeName) {
                    for (const key in t) {
                        const val = t[key];
                        // Ignorujeme klíče obsahující 'id' a ne-string hodnoty
                        if (typeof val === 'string' && !key.toLowerCase().includes('id') && isNaN(val)) {
                            typeName = val;
                            break;
                        }
                    }
                }
                
                // Poslední záchrana - pokud máme ID a nic jiného, tak to asi nepůjde, ale zkusíme cokoliv stringového
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
                original: t, // Uchováme si původní objekt pro případ potřeby při ukládání
                value: 0
            };
        });
        
        renderDrinks();
    } catch (error) {
        console.error('Error fetching drinks:', error);
        document.getElementById('drinks-list').innerHTML = '<p>Chyba při načítání nápojů.</p>';
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
        // Použijeme setTimeout, aby se zajistilo, že DOM je připraven
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

    // Při odesílání použijeme 'type' (název), jak bylo požadováno v zadání
    const payloadDrinks = drinksList.map(d => ({
        type: d.type,
        value: d.value
    }));

    const payload = {
        user: selectedUserId,
        drinks: payloadDrinks
    };

    console.log('Sending payload:', payload);

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
            alert('Chyba serveru: ' + response.status);
        }
    } catch (error) {
        console.error('Save error:', error);
        alert('Chyba při odesílání.');
    }
}

function resetDrinks() {
    drinksList.forEach(d => d.value = 0);
    renderDrinks();
}
