# 🎨 Ghid Web Studio & Simulator Hardware

Pachetul **VW RNS 510 Bootlogo Toolkit** include o aplicație web completă, construită cu tehnologii moderne (**Next.js 16**, **React 19**, **Tailwind CSS** și motor Python), oferind o experiență interactivă de studio direct în browserul tău.

---

## 🚀 Cum se Pornește Web Studio

Există două modalități rapide de lansare:

### Varianta 1 (Recomandată — Dublu Click pe Windows):
* Fă dublu click pe fișierul **`start_web_studio.bat`** din rădăcina proiectului.
* Fereastra va lansa automat serverul local și va deschide pagina în browserul tău la adresa:  
  👉 **`http://localhost:3000`**

### Varianta 2 (Din Terminal / Linie de Comandă):
```bash
cd RNS510-Bootlogo-Toolkit/web
npm install       # Doar la prima rulare dacă nu sunt instalate modulele
npm run dev
```

---

## 🕹️ Funcționalități Cheie ale Web Studio

### 1. 📺 Simulatorul Realist de Bord (Bezel Simulator)
* **Modul Cockpit (Bord OEM):** Simulează unitatea fizică RNS 510 exact așa cum se află montată în bordul mașinii: fantă de CD, butoane tactile (`RADIO`, `MEDIA`, `NAV`, `SETUP`) și butoane rotative de volum/acord.
* **Modul Fără Ramă (Frameless 800×480):** Afișează doar ecranul curat nativ WVGA la rezoluție exactă.
* **Modul Comparație Split (Hardware Split View):** Poți trage de glisorul interactiv stânga-dreapta pentru a compara imaginea originală (32-bit sRGB de pe PC) cu rezultatul simulat în hardware-ul 15-bit RGB555 de pe mașină.
* **Grilă de Pixeli TFT (CRT/LCD Matrix):** Simulează textura fizică a matricei de subpixeli a ecranului TFT auto.
* **Iluminare Roșie Butoane OEM:** Activează strălucirea roșie a butoanelor fizice din jurul ramei, specifică habitaclului Volkswagen pe timp de noapte.

---

### 2. 🛡️ Panoul de Diagnoză în Timp Real (Diagnostic Badge)
Fiecare modificare de imagine (luminozitate, contrast, încadrare) este analizată instantaneu de algoritmul de simulare:
* **Rezoluție:** Validare 800 × 480 (exact 384.000 pixeli).
* **Format Culori:** Verificare spațiu de culoare RGB555 15-bit.
* **Erori Bit 15:** Monitorizează dacă vreun pixel are bitul 15 activat (este forțat automat pe 0).
* **Purici Verzi:** Contorizează dacă există micro-zgomot parazit pe degradeurile negre.
* **CRC-16 Engine:** Confirmă disponibilitatea algoritmului de sumă de control.

---

### 3. 🚗 Galeria de Modele OEM & Creatorul de Insigne Personalizate (Presets Tab)
* Conține o colecție de sigle gata configurate din fabricație:
  * **Volkswagen R Performance** (Fond Carbon + Dynaudio Sound)
  * **Golf GTI / Edition 35** (Accente Roșii Sport)
  * **Dynaudio Sound System**
  * **R-Line Sport Edition**
  * **Škoda vRS Motorsport**
  * **SEAT Cupra Performance**
* **Creator Text / Model Propriu:**
  * Poți tasta orice text dorești (ex: `GOLF 6 R`, `PASSAT B7`, `TIGUAN 4MOTION`, `EDWARD03`).
  * Poți adăuga un slogan secundar (ex: `EXCLUSIVE EDITION`).
  * Poți alege culoarea de accent (Turcoaz VW, Roșu GTI, Albastru Cobalt, Verde vRS, Cupru Cupra, etc.).
  * Apăsând butonul **Trimite în Studio**, modelul tău generat vectorial este trimis instant în simulator!

---

### 4. 🔍 Decompilatorul & Inspectorul ISO / FLI (Inspector Tab)
Ai descărcat un fișier `.iso` sau `.fli` mai vechi de pe internet și nu ești sigur dacă este curat sau dacă îți va da purici verzi pe ecran?
1. Trage fișierul `.iso` sau `.fli` în tabul **Decompilator & Diagnoză**.
2. Aplicația decompilează automat fișierul fără să-l ardă pe disc.
3. Îți generează un **raport complet de sănătate**:
   * Validitatea semnăturii magice `0xAA55AA55`.
   * Suma de control a antetului (CRC1) și a datelor (CRC2).
   * Suma de control `CRC.16` pentru `ECUORDER.TXT`.
   * Prezența bitului 15 activat sau a pixelilor verzi paraziți.
4. Îți afișează pe ecran imaginea exact așa cum o vede navigația și îți oferă butonul **„Repară Automat & Generează ISO Nou Curat”** dacă detectează defecte!

---

### 5. 📱 Optimizare 100% pentru Mobile și Ecrane Mici
* Interfața este complet fluidă pe telefoane (iOS / Android) și tablete.
* Header-ul se rearanjează pe două rânduri inteligente pentru a preveni derularea orizontală a paginii.
* Butoanele din rama RNS 510 se scalează proporțional, oferind spațiu generos ecranului principal.
* La reîncărcarea paginii (**Refresh**), zona de lucru pornește complet curată, fără nicio miniatură de imagine coruptă.
