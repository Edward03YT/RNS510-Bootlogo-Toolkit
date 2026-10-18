# VW RNS 510 Bootlogo Toolkit 🚗✨
**Generator Logo Personalizat, Creator ISO Bootabil, Decompilator & Verificator Calitate Fără Artefacte**

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Licență: GPL-3.0](https://img.shields.io/badge/Licență-GPLv3-green.svg)](LICENSE)
[![Platformă](https://img.shields.io/badge/platformă-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()
[![Testat pe RNS 510](https://img.shields.io/badge/testat%20pe-VW%20RNS%20510%20%7C%20Columbus%20%7C%20Seat%20Media-red.svg)]()

> 🌐 **Language / Limbă**:  
> [🇬🇧 **English Documentation (README.md)**](README.md) | **Ghid Română** (Curent)

---

## 📖 Despre Acest Proiect

**VW RNS 510 Bootlogo Toolkit** este un pachet complet de instrumente open-source creat special pentru comunitatea pasionaților auto, destinat personalizării imaginii de pornire (boot splash logo) pentru sistemele de navigație **Volkswagen RNS 510**, **Škoda Columbus** și **SEAT Media System**.

### ⚠️ De ce era nevoie de acest proiect?
Multe dintre scripturile vechi sau site-urile web apărute pe forumuri generau imagini cu defecte vizibile: **purici verzi fluorescenți** pe fundal negru, canale de culoare decalate sau sume de control (CRC) greșite care duceau la erori la scrierea CD-ului (`SWL Error`).

Acest pachet rezolvă definitiv aceste probleme prin:
1. **Encodare nativă RGB555 pe 15 biți** cu bitul 15 curățat la 0 (spre deosebire de alte utilitare care folosesc greșit RGB565).
2. **Filtru inteligent anti-zgomot/compresie** care elimină artefactele de compresie JPEG/PNG de pe fundalurile închise.
3. **Compresie RLE (Run-Length Encoding) nativă big-endian** identică cu cea din softul original de fabrică.
4. **Calcul matematic exact al sumelor CRC-16/XMODEM** atât în antetul `.FLI`, cât și în fișierul `CRC.16` de pe disc.
5. **Generare directă de fișiere ISO bootabile** compatibile 100% cu unitățile RNS 510.
6. **Decompilator și vizualizator de ISO**: poți deschide orice ISO (nou sau vechi de pe internet) pentru a vedea cum va arăta pe ecranul navigatiei și dacă are purici verzi înainte să arzi CD-ul.
7. **Suport Bilingv Complet**: Comutare instantă între **Română** și **Engleză** direct din interfață.

---

## 🌟 Funcționalități Principale

* **🎨 Interfață Grafică Modernă (GUI)**:
  * Design modern, temă întunecată (Dark Mode), optimizat pentru vizualizare clară.
  * Previzualizare în timp real a imaginii simulate exact cum va apărea pe ecranul mașinii.
  * Comutator rapid de limbă `[🇬🇧 English / 🇷🇴 Română]`.
  * Bară de progres și confirmare vizuală a creării imaginii.

* **🔍 Decompilator și Vizualizator ISO (`rns510_iso_viewer.py`)**:
  * Citește direct din fișierul `.iso` fără a necesita extragere manuală.
  * Decompilează fișierul `LOGO.FLI`, verifică integritatea datelor și numărul de pixeli (384.000).
  * Scanează automat dacă există pixeli verzi sau aberații cromatice.
  * Permite salvarea imaginii extrase ca fișier PNG 800×480.

* **🛡️ Fără Purici Verzi / Filtru Anti-Artefacte**:
  * Imaginile sunt transformate în culori RGB555 pe 15 biți (`0RRRRRGGGGGBBBBB`).
  * Bitul 15 este menținut la 0, eliminând erorile de decodare hardware ale procesorului grafic din RNS 510.
  * Curăță automat micro-zgomotul din degradeurile întunecate.

* **📀 Creare ISO Bootabil Sigură**:
  * Pachetul include structura originală de actualizare SWL: `WA/LOGO.FLI`, `VERSION.TXT`, `BLSCRIPT.CFG`, `DIR.INF`, `SWL.FLI`.
  * Calculează automat suma `CRC-16/XMODEM` pentru `ECUORDER.TXT` și creează fișierul `CRC.16`.
  * Scrie exclusiv în sectorul de memorie 15 (`STRATA_UPDATE 15`). **Nu atinge hărțile de navigație, codările radio (VCDS), sistemul de operare sau setările mașinii**.

* **⚡ Fișiere Batch Rapide (Drag & Drop pentru Windows)**:
  * `create_bootable_iso.bat`: Tragi o poză peste el și obții instant ISO-ul bootabil.
  * `verify_logo_quality.bat`: Tragi o poză, un `.fli` sau un `.iso` pentru o diagnoză completă în consolă.
  * `decompile_view_iso.bat`: Tragi un fișier `.iso` pentru a-l deschide în vizualizator.

---

## 🔬 Detalii Tehnice (Inginerie Inversă)

### 1. Structura Antetului de 64 de octeți (`.FLI`)
```text
Octeți    Dimensiune  Tip           Descriere
--------------------------------------------------------------------------------
0x00      4 octeți    uint32_be     Semnătură Magică: 0xAA55AA55
0x04      4 octeți    uint32_be     CRC1 Antet (CRC-16/XMODEM pentru octeții 0x08..0x3F)
0x08      4 octeți    uint32_be     Lățime imagine: 800 (0x00000320)
0x0C      4 octeți    uint32_be     Înălțime imagine: 480 (0x000001E0)
0x10      4 octeți    uint32_be     CRC2 Date (CRC-16/XMODEM pentru fluxul RLE complet)
0x14      4 octeți    uint32_be     Dimensiune necomprimată: 768.000 octeți (800 * 480 * 2)
0x18      4 octeți    uint32_be     Indicator format: 0x00000001
0x1C      4 octeți    uint32_be     Dimensiune antet: 0x00000040 (64 octeți)
0x20..3F  32 octeți   bytes         Padding cu zero (0x00)
```

### 2. Formatul de Culoare: 15-Bit RGB555
Display-ul RNS 510 folosește spațiul de culoare **RGB555**, nu cel clasic de PC RGB565:
* **Bit 15**: Întotdeauna `0`.
* **Biții 14–10**: Roșu (5 biți, valori 0–31).
* **Biții 9–5**: Verde (5 biți, valori 0–31).
* **Biții 4–0**: Albastru (5 biți, valori 0–31).

> **De ce apăreau purici verzi în scripturile vechi?**  
> Instrumentele mai vechi converteau imaginea în RGB565 (6 biți pentru verde) sau shiftau greșit canalul verde, aprinzând bitul 15 sau biți paraziți pe verde. Procesorul grafic RNS 510 interpreta acest bit ca o valoare mare de verde pe fundalurile negre. Scriptul nostru forțează bitul 15 pe 0 și curăță zgomotul de fond.

### 3. Compresia RLE (Run-Length Encoding)
După antetul de 64 de octeți urmează fluxul comprimat. Datele sunt împărțite în grupuri de câte 4 octeți:
```text
[2 octeți: Culoare RGB555] [2 octeți: Număr de repetări pixel]
```
Imaginea este scanată de la stânga la dreapta, linie cu linie, de sus până jos (exact 384.000 pixeli în total).

### 4. Sumele de Control (CRC)
* **CRC1 și CRC2**: Standard `CRC-16/XMODEM` (Polinom: `0x1021`, Valoare inițială: `0x0000`).
* **Fișierul `CRC.16`**: Conține textul hexadecimal de 4 caractere al sumei `CRC-16/XMODEM` calculate pentru fișierul `ECUORDER.TXT`.

---

## 📦 Cerințe & Instalare

1. Asigură-te că ai instalat **Python 3.8** sau o versiune mai nouă de pe [python.org](https://www.python.org/downloads/) (Bifează căsuța *"Add Python to PATH"* la instalare).
2. Descarcă sau clonează acest repository:
   ```bash
   git clone https://github.com/your-username/RNS510-Bootlogo-Toolkit.git
   cd RNS510-Bootlogo-Toolkit
   ```
3. Instalează modulele necesare rulând comanda:
   ```bash
   pip install -r requirements.txt
   ```
   *(Pachetele utilizate sunt `Pillow>=9.0.0` pentru procesare imagini și `pycdlib>=1.12.0` pentru crearea fișierelor ISO).*

---

## 🚀 Ghid de Utilizare

### Metoda 1: Interfața Grafică (Recomandat)
Fă dublu-click pe fișierul `create_bootable_iso.bat` sau deschide terminalul și tastează:
```bash
python rns510_bootlogo.py --gui
```
1. Apasă pe butonul **"Alege Imagine (PNG, JPG)"** și selectează poza dorită (dimensiunea ideală este 800×480).
2. Alege modul de scalare:
   * **Potrivire cu margini negre (Letterbox)**: Păstrează proporțiile originale ale pozei.
   * **Întinde la 800x480 (Stretch)**: Umple tot ecranul.
3. Asigură-te că opțiunea **"Filtru Anti-Artefacte (Fără Purici Verzi)"** este bifată.
4. Apasă pe **"Creează ISO Bootabil RNS 510"**.
5. În câteva secunde, ISO-ul gata de scris pe CD și o imagine PNG de previzualizare vor fi generate!

---

### Metoda 2: Decompilare și Verificare ISO-uri Existente
Dacă ai descărcat un ISO de pe internet sau vrei să verifici un fișier înainte de a-l scrie pe disc:
Fă dublu-click pe `decompile_view_iso.bat` sau rulează:
```bash
python rns510_iso_viewer.py
```
* Poți rula și în mod linie de comandă (CLI):
  ```bash
  python rns510_iso_viewer.py fisierul_meu.iso --cli
  ```
Programul va citi direct discul, va verifica sumele CRC, va reconstrui imaginea de 800×480 și îți va afișa dacă există pixeli suspecți sau purici verzi.

---

### Metoda 3: Drag & Drop (Rapid pe Windows)
* **Pentru a face un ISO**: Trage cu mouse-ul o poză peste fișierul `create_bootable_iso.bat`.
* **Pentru a testa calitatea**: Trage o poză, un fișier `.fli` sau un fișier `.iso` peste `verify_logo_quality.bat`.
* **Pentru a deompila un ISO**: Trage un fișier `.iso` peste `decompile_view_iso.bat`.

---

### Metoda 4: Linie de Comandă (CLI)
```bash
# Creare ISO cu setările implicite:
python rns510_bootlogo.py poza_mea.png -o bootlogo.iso

# Întindere imagine pe tot ecranul:
python rns510_bootlogo.py poza_mea.jpg -o bootlogo.iso --fit stretch

# Salvare doar a fișierului LOGO.FLI (fără crearea unui ISO întreg):
python rns510_bootlogo.py poza_mea.png --fli-only LOGO.FLI

# Verificare completă și diagnoză a unui ISO sau imagini:
python rns510_bootlogo.py bootlogo.iso --verify
```

---

## 💿 Instrucțiuni Pentru Scrierea pe CD și Instalarea pe Mașină

### Pasul 1: Scrierea CD-ului
1. Folosește un **CD-R** de bună calitate (de exemplu: Verbatim, Sony, TDK). **NU folosi CD-RW (reinscriptibil) și NU folosi DVD-uri**; lentila optică a unității citește mult mai ușor discurile CD-R.
2. Folosește un program de scriere gratuit precum **ImgBurn** sau **CDBurnerXP**.
3. Selectează opțiunea **"Write image file to disc"** (Scriere imagine pe disc).
4. Setează viteza de scriere la **cea mai mică viteză disponibilă** (recomandat **4x** sau **8x**). Acest lucru asigură o ardere adâncă și precisă pe disc.
5. Bifează opțiunea **Verify disc** (Verificare după scriere).

### Pasul 2: Instalarea pe Sistemul RNS 510
> 💡 **Sfat de siguranță**: Actualizarea logo-ului durează doar aproximativ **1 - 2 minute** și scrie exclusiv în sectorul de memorie Flash 15. Este recomandat să ai contactul pus. Dacă bateria mașinii este mai veche sau descărcată, poți lăsa motorul pornit la relanti (în parcare / N) sau să conectezi un redresor.

1. Pune contactul mașinii și pornește unitatea **RNS 510**.
2. Scoate orice CD de muzică sau DVD de navigație aflat deja în aparat.
3. Introdu CD-ul proaspăt scris cu noul logo în fanta unității.
4. Apasă și ține apăsată simultan combinația de trei taste pentru restart:
   * **`SETUP` + `EJECT` + `MIC`** (sau butonul cu steluță **`INFO`** la unitățile cu butoane fizice mai vechi).
5. Unitatea se va restarta și va intra în modul **Software Loading (SWL)**.
6. Pe ecran va apărea mesajul de confirmare a actualizării de software.
7. Confirmă apăsând pe butonul **OK** de pe ecran.
8. Bara de progres va avansa timp de aproximativ 60 - 90 de secunde.
9. La final, unitatea va scoate automat CD-ul afară și se va restarta afișând noul tău logo personalizat!

---

## 📂 Structura Fișierelor din Repository

```text
RNS510-Bootlogo-Toolkit/
│
├── rns510_bootlogo.py         # Scriptul principal: Conversie imagine -> RGB555 FLI -> Creare ISO
├── rns510_iso_viewer.py       # Decompilator ISO & Vizualizator diagnostic de calitate
├── create_bootable_iso.bat    # Fișier Windows Drag-and-Drop / Dublu-click pentru creare ISO
├── verify_logo_quality.bat    # Fișier Windows Drag-and-Drop pentru scanare artefacte și purici verzi
├── decompile_view_iso.bat     # Fișier Windows Drag-and-Drop pentru vizualizare ISO
├── requirements.txt           # Dependențele Python (Pillow, pycdlib)
├── LICENSE                    # Licența GNU General Public License v3.0
├── README.md                  # Documentația completă în limba Engleză
├── README_RO.md               # Acest ghid în limba Română
│
└── template_swl/              # Șabloanele originale de fișiere pentru actualizarea SWL
    ├── BLSCRIPT.CFG           # Script de pornire bootloader
    ├── DIR.INF                # Index directoare disc
    ├── VERSION.TXT            # Descriere versiune firmware
    └── SWL/
        └── SILVER_1/
            └── RNSMIDEC/
                └── SWL/
                    └── SWL.FLI # Payload original de bootloader
```

---

## 🤝 Contribuții

Orice contribuție, sugestie sau raportare de bug este binevenită! Dacă descoperi o versiune specială de firmware sau un caz particular de imagine, deschide un Issue pe GitHub.

---

## 📜 Licență

Acest proiect este publicat sub licența **GNU General Public License v3.0** (GPL-3.0). Consultă fișierul [LICENSE](LICENSE) pentru mai multe detalii.

---

*Volkswagen, Škoda, SEAT și RNS 510 sunt mărci înregistrate ale Volkswagen AG. Acest proiect este un utilitar independent dezvoltat de pasionați și nu este afiliat sau aprobat de Volkswagen AG.*
