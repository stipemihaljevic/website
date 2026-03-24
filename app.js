// --- ELEMENTI SUČELJA ---
const authSekcija = document.getElementById('authSekcija');
const lobbySekcija = document.getElementById('lobbySekcija');
const cekaonicaSekcija = document.getElementById('cekaonicaSekcija');
const igraSekcija = document.getElementById('igraSekcija');

const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const authPoruka = document.getElementById('authPoruka');
const sobaInput = document.getElementById('sobaInput');

const infoPanel = document.getElementById('info-panel');
const centerPile = document.getElementById('center-pile');
const myHand = document.getElementById('my-hand');
const pointsModal = document.getElementById('pointsModal');

// --- OSNOVNI URL-ovi (Lokalno testiranje) ---
const API_BASE_URL = 'http://127.0.0.1:8000/api';
const WS_BASE_URL = 'ws://127.0.0.1:8000/ws/igra';

// --- STANJE IGRE ---
let gameSocket = null;
let trenutniKorisnik = null;
let trenutnaSoba = null;
let igraciUSobi = [];
let trenutnaFaza = 'cekanje';
let trenutnoNaPotezu = null;
let mojaRuka = [];
let odabraniPoeni = null;

const snagaBoje = { '♥': 1, '♦': 2, '♣': 3, '♠': 4 };
const snagaKarte = { 'A': 8, 'K': 7, 'Q': 6, 'J': 5, '10': 4, '9': 3, '8': 2, '7': 1 };

// --- PRIJAVA I REGISTRACIJA ---
document.getElementById('loginBtn').onclick = () => autentifikacija('/login/');
document.getElementById('registerBtn').onclick = () => autentifikacija('/register/');

function autentifikacija(endpoint) {
    const username = usernameInput.value;
    const password = passwordInput.value;

    if (!username || !password) {
        authPoruka.innerText = "Unesi korisničko ime i lozinku!";
        return;
    }

    fetch(API_BASE_URL + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
    })
    .then(response => {
        if (!response.ok) throw new Error("Neuspješno.");
        return response.json();
    })
    .then(data => {
        trenutniKorisnik = username;
        prikaziLobby();
    })
    .catch(error => {
        authPoruka.innerText = "Greška: Provjeri podatke ili korisnik već postoji.";
    });
}

function prikaziLobby() {
    authSekcija.style.display = 'none';
    cekaonicaSekcija.style.display = 'none';
    igraSekcija.style.display = 'none';
    lobbySekcija.style.display = 'block';
    document.getElementById('imePrijavljenog').innerText = trenutniKorisnik;
}

document.getElementById('logoutBtn').onclick = function() {
    location.reload(); 
};

// --- LOBBY: KREIRANJE ILI SPAJANJE ---

// Gumb kreiraj otvara modal
document.getElementById('kreirajSobuBtn').onclick = () => {
    const soba = sobaInput.value.trim();
    if (soba === "") { alert("Unesi ime sobe!"); return; }
    pointsModal.style.display = 'flex';
};

// Gumb za zatvaranje modala
document.getElementById('closeModalBtn').onclick = () => pointsModal.style.display = 'none';

// Odabir poena i kreiranje sobe
document.querySelectorAll('.point-btn').forEach(btn => {
    btn.onclick = function() {
        odabraniPoeni = this.getAttribute('data-points');
        pointsModal.style.display = 'none';
        spojiSeNaSobu(sobaInput.value.trim(), true);
    }
});

// Pridruživanje postojećoj sobi
document.getElementById('joinRoomBtn').onclick = () => {
    const soba = sobaInput.value.trim();
    if (soba === "") { alert("Unesi ime sobe!"); return; }
    spojiSeNaSobu(soba, false);
};

function spojiSeNaSobu(imeSobe, jeLiKreator) {
    trenutnaSoba = imeSobe;
    
    lobbySekcija.style.display = 'none';
    cekaonicaSekcija.style.display = 'block';
    document.getElementById('cekaonicaImeSobe').innerText = trenutnaSoba;
    if(odabraniPoeni) document.getElementById('cekaonicaPoeni').innerText = odabraniPoeni;
    
    gameSocket = new WebSocket(`${WS_BASE_URL}/${trenutnaSoba}/`);
    
    gameSocket.onopen = function() {
        gameSocket.send(JSON.stringify({
            'akcija': 'pridruzi_se', 
            'igrac': trenutniKorisnik,
            'poeni': odabraniPoeni 
        }));
    };

    gameSocket.onmessage = function(e) {
        const data = JSON.parse(e.data);
        
        // 1. Osvježavanje Čekaonice
        if (data.akcija === 'stanje_sobe') {
            igraciUSobi = data.igraci;
            
            if (data.poeni) document.getElementById('cekaonicaPoeni').innerText = data.poeni;

            for(let i=0; i<4; i++) {
                const slot = document.getElementById(`slot-${i}`);
                slot.innerHTML = 'čeka se...';
                slot.classList.remove('filled');
            }

            igraciUSobi.forEach((igrac, index) => {
                const slot = document.getElementById(`slot-${index}`);
                let kruna = (index === 0) ? " 👑" : ""; 
                slot.innerHTML = `<strong>${igrac}</strong>${kruna}`;
                slot.classList.add('filled');
            });

            const startBtn = document.getElementById('startIgraBtn');
            if (trenutniKorisnik === data.host) {
                document.getElementById('gostPoruka').style.display = 'none';
                startBtn.style.display = 'block';
                startBtn.disabled = igraciUSobi.length !== 4; 
            } else {
                startBtn.style.display = 'none';
                document.getElementById('gostPoruka').style.display = 'block';
            }
        }

        // 2. Igra počinje
        if (data.akcija === 'igra_pocinje') {
            trenutnaFaza = 'zvanje';
            cekaonicaSekcija.style.display = 'none';
            igraSekcija.style.display = 'flex';
            document.getElementById('imeSobePrikaz').innerText = trenutnaSoba;
            
            postaviIgraceNaStol(igraciUSobi);
            
            document.querySelectorAll('.dealer-chip').forEach(el => el.remove());
            const dealerLabel = Array.from(document.querySelectorAll('.player-label')).find(el => el.innerText.includes(data.djelitelj));
            if (dealerLabel) dealerLabel.innerHTML += ` <span class="dealer-chip" style="background: white; color: black; border-radius: 50%; padding: 2px 6px; font-weight: bold; margin-left: 5px;">D</span>`;
            
            centerPile.innerHTML = `
                <div id="bidding-box" style="display: none; position: absolute; background: #2c3e50; padding: 15px; border-radius: 10px; text-align: center; border: 2px solid #f1c40f; box-shadow: 0 10px 30px rgba(0,0,0,0.8); z-index: 50; width: 320px;">
                    <h4 style="margin-top:0; color: white;">Odaberi Adut</h4>
                    <div>
                        <button class="suit-btn red" onclick="zoviAdut('Srce')" style="font-size: 1.8rem; cursor: pointer; border-radius: 5px; background: transparent; border: none;">♥</button>
                        <button class="suit-btn red" onclick="zoviAdut('Karo')" style="font-size: 1.8rem; cursor: pointer; border-radius: 5px; background: transparent; border: none;">♦</button>
                        <button class="suit-btn" onclick="zoviAdut('Žir')" style="font-size: 1.8rem; cursor: pointer; border-radius: 5px; background: transparent; border: none; color: white;">♣</button>
                        <button class="suit-btn" onclick="zoviAdut('List')" style="font-size: 1.8rem; cursor: pointer; border-radius: 5px; background: transparent; border: none; color: white;">♠</button>
                    </div>
                    <button id="btnDalje" class="sys-btn btn-red" style="font-size: 1rem; padding: 8px 20px; margin-top: 15px;" onclick="reciDalje()">Dalje</button>
                </div>
            `;
            
            infoPanel.innerText = `Dijeli: ${data.djelitelj}. Čekamo zvanje...`;
            
            if (data.ruke[trenutniKorisnik]) {
                mojaRuka = data.ruke[trenutniKorisnik];
                osvjeziPrikazRuke();
            }
        }

        // 3. Kontrola zvanja
        if (data.akcija === 'na_redu_za_zvanje') {
            trenutnoNaPotezu = data.igrac;
            const biddingBox = document.getElementById('bidding-box');
            if (!biddingBox) return;

            if (data.igrac === trenutniKorisnik) {
                infoPanel.innerText = "Tvoj je red za zvanje!";
                biddingBox.style.display = 'block';
                document.getElementById('btnDalje').style.display = data.mora_zvati ? 'none' : 'inline-block';
            } else {
                infoPanel.innerText = `Na redu za zvanje: ${data.igrac}`;
                biddingBox.style.display = 'none';
            }
        }

        // 4. Adut odabran
        if (data.akcija === 'adut_odabran') {
            trenutnaFaza = 'igranje';
            const biddingBox = document.getElementById('bidding-box');
            if(biddingBox) biddingBox.style.display = 'none';
            
            infoPanel.innerText = `Adut je ${data.adut} (zvao: ${data.tko_je_zvao}).`;
            
            if (data.dodatne_karte[trenutniKorisnik]) {
                mojaRuka.push(...data.dodatne_karte[trenutniKorisnik]);
                osvjeziPrikazRuke();
            }
        }

        // 5. Javljanje za bacanje
        if (data.akcija === 'na_redu_bacanje') {
            trenutnoNaPotezu = data.igrac;
            if (data.igrac === trenutniKorisnik) {
                infoPanel.innerText = "Tvoj je red! Baci kartu.";
            } else {
                infoPanel.innerText = `Na potezu je: ${data.igrac}`;
            }
        }

        // 6. Karta bačena
        if (data.akcija === 'karta_bacena') {
            const pozicija = odrediPozicijuNaStolu(data.igrac);
            
            const el = document.createElement('div');
            el.className = `card played-card ${pozicija} ${data.boja === 'red' ? 'red' : ''}`;
            el.innerHTML = `<span>${data.karta_vrijednost}</span><span>${data.karta_znak}</span>`;
            
            document.getElementById('center-pile').appendChild(el);
        }
    };
}

// --- AKCIJE: DOMAĆIN I ZVANJE ---
document.getElementById('startIgraBtn').onclick = function() {
    gameSocket.send(JSON.stringify({'akcija': 'start_igre', 'igrac': trenutniKorisnik}));
};

function zoviAdut(odabraniZnak) {
    gameSocket.send(JSON.stringify({'akcija': 'zovi_adut', 'igrac': trenutniKorisnik, 'odabrani_adut': odabraniZnak}));
}

function reciDalje() {
    gameSocket.send(JSON.stringify({'akcija': 'reci_dalje', 'igrac': trenutniKorisnik}));
}

// --- LOGIKA POZICIJA NA STOLU ---
function postaviIgraceNaStol(igraci) {
    const mojIndex = igraci.indexOf(trenutniKorisnik);
    
    let desno = (mojIndex + 1) % 4;   
    let partner = (mojIndex + 2) % 4; 
    let lijevo = (mojIndex + 3) % 4;  

    document.getElementById('prikazIgraca').innerText = trenutniKorisnik;
    document.getElementById('label-sjever').innerText = igraci[partner];
    document.getElementById('label-istok').innerText = igraci[desno];
    document.getElementById('label-zapad').innerText = igraci[lijevo];
}

function odrediPozicijuNaStolu(igracKojiBaca) {
    if (igracKojiBaca === trenutniKorisnik) return 'south'; 
    
    const mojIndex = igraciUSobi.indexOf(trenutniKorisnik);
    const njegovIndex = igraciUSobi.indexOf(igracKojiBaca);
    
    const razlika = (njegovIndex - mojIndex + 4) % 4;
    
    if (razlika === 1) return 'east';
    if (razlika === 2) return 'north';
    if (razlika === 3) return 'west';
}

// --- IZRADA I SORTIRANJE RUKE ---
function osvjeziPrikazRuke() {
    myHand.innerHTML = '';
    
    mojaRuka.sort((a, b) => {
        if (snagaBoje[a.znak] !== snagaBoje[b.znak]) {
            return snagaBoje[a.znak] - snagaBoje[b.znak];
        }
        return snagaKarte[b.vrijednost] - snagaKarte[a.vrijednost];
    });

    mojaRuka.forEach(k => {
        const el = document.createElement('div');
        el.className = `card ${k.boja === 'red' ? 'red' : ''}`;
        el.innerHTML = `<span>${k.vrijednost}</span><span>${k.znak}</span>`;
        
        el.onclick = function() {
            if (trenutnaFaza !== 'igranje') {
                alert("Polako! Još traje zvanje aduta.");
                return;
            }
            if (trenutnoNaPotezu !== trenutniKorisnik) {
                alert("Nije tvoj red za bacanje karata!");
                return;
            }
            
            gameSocket.send(JSON.stringify({
                'akcija': 'baci_kartu', 
                'karta_vrijednost': k.vrijednost, 
                'karta_znak': k.znak, 
                'boja': k.boja, 
                'igrac': trenutniKorisnik
            }));
            
            mojaRuka = mojaRuka.filter(karta => !(karta.vrijednost === k.vrijednost && karta.znak === k.znak));
            osvjeziPrikazRuke();
        };
        
        myHand.appendChild(el);
    });
}