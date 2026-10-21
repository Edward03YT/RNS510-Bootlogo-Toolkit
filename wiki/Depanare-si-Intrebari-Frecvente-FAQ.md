# 🛠️ Depanare & Întrebări Frecvente (FAQ)

Ghid de diagnoză și soluții pentru cele mai frecvente situații întâlnite în procesul de actualizare a siglei de pornire pe unitățile **RNS 510**.

---

## ❓ Întrebări Frecvente (FAQ)

### 1. Se șterg hărțile de pe HDD sau codările radio (VCDS / OBD11)?
**Răspuns: Categoric NU.**  
Fișierul `ECUORDER.TXT` din discul nostru folosește comanda directă:
```text
STRATA_UPDATE 15 <dimensiune> /cddos/WA/LOGO.FLI
```
Această comandă scrie **exclusiv în Partiția 15 (Boot Splash Image)** a memoriei flash. Nu atinge hard disk-ul (partițiile de hărți și muzică), nu modifică codările de Gateway / CAN și nu rescrie memoria EEPROM unde sunt salvate setările mașinii.

---

### 2. Ce versiuni de RNS 510 și firmware sunt compatibile?
Toolkit-ul suportă **toate unitățile din platforma Continental / Siemens VDO RNS 510, Columbus și Media System**:
* **Versiuni Hardware:** C3, C4A, C5C, C6, C10, C12, C14 (toate modelele de la 2007 până la 2018).
* **Coduri de piesă compatibile:**
  * VW: `1T0035680` (indiferent de litera finală: A, B, C, D, F, G, H, P, Q, R, T etc.)
  * Škoda: `3T0035680` (A, B, C, D, E etc.)
  * SEAT: `7F0035680` / `7E0035680`
* **Versiuni de Firmware suportate:** De la firmware vechi `1100`, `2720`, `3810`, `3980`, până la cele mai noi `5238`, `6270`, `6276`.

---

### 3. De ce navigația mea nu intră în modul SWL la apăsarea tastelor `SETUP + EJECT + MIC`?
* Dacă mașina ta are o unitate fabricată între anii 2007 și 2009 (versiuni hardware A sau B), tasta din dreapta sus nu are simbolul de Microfon (`🎤`), ci simbolul de Informație (**`i`** sau `INFO`).
* Combinația corectă pentru aceste unități este:
  > **`SETUP` + `EJECT (⏏)` + `INFO (i)`**

---

### 4. Dacă scot cheia sau opresc motorul în timpul scrierii, se poate strica navigația?
* Deoarece procesul durează doar ~90 de secunde, riscul este minim dacă bateria mașinii este în stare bună.
* Dacă totuși se întrerupe alimentarea exact în timpul scrierii sectorului 15, unitatea nu va porni logo-ul, dar va rămâne în modul de siguranță al bootloader-ului.
* **Soluție de recuperare:** Pornești din nou navigația cu tastele `SETUP + EJECT + MIC/INFO`, reintroduci CD-ul, iar bara de progres va rescrie sectorul 15 de la capăt.

---

## 🚨 Ghid de Depanare (Troubleshooting)

### Problema A: Unitatea dă `SWL Error` sau `CD/DVD Error` și ejectează discul după 5 secunde
* **Cauza 1:** Discul a fost ars pe un **CD-RW** (rescriabil) sau pe un **DVD**.
  * *Soluție:* Folosește exclusiv un **CD-R** simplu de calitate (recomandat **Verbatim AZO**).
* **Cauza 2:** Discul a fost scris la o viteză prea mare (16x, 24x, 52x).
  * *Soluție:* Deschide ImgBurn și setează viteza de scriere la **`4x`** sau cel mult **`8x`**.
* **Cauza 3:** Lentila laser a unității optice este îmbătrânită sau murdară de praf.
  * *Soluție:* Folosește un CD de curățare a lentilei laser sau încearcă o altă marcă de disc CD-R de calitate superioară.

---

### Problema B: Unitatea a rămas blocată în ecranul gri `Software Loading` și nu pornește radio-ul
* Dacă ai introdus un CD greșit sau ai apăsat combinația de taste din greșeală:
  * Scoate CD-ul din fantă dacă există.
  * Apasă din nou simultan **`SETUP + EJECT + MIC`** timp de 3 secunde pentru a forța o repornire normală (Cold Reboot). Unitatea va ieși din modul de actualizare și va porni normal în modul Radio/Navigație.

---

### Problema C: Am folosit alt program pe internet și am purici verzi pe ecran
* Dacă ai scris un bootlogo creat cu un alt utilitar vechi și ai puncte verzi fluorescente pe ecran:
  1. Deschide aplicația noastră web (`start_web_studio.bat`) sau folosește scriptul `create_bootable_iso.bat`.
  2. Generează un nou disc ISO din imaginea ta curată (sau alege un preset din Galeria noastră).
  3. Arde noul CD și instalează-l conform [Ghidului de Flashing](Ghid-Flashing-si-Scriere-CD).
  4. Noul fișier va rescrie complet sectorul 15 cu bitul 15 curățat pe 0, eliminând instantaneu toți puricii verzi!
