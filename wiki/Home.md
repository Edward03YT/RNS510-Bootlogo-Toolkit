# 🚗 VW RNS 510 Bootlogo Toolkit — Pagina Oficială Wiki

Bine ați venit pe documentația oficială a proiectului **VW RNS 510 Bootlogo Toolkit**, întreținut de **Edward03**.

Acest toolkit reprezintă cel mai complet și precis pachet open-source dedicat personalizării siglei de pornire (*boot splash logo*) pentru unitățile de navigație de fabrică din grupul VAG:
* **Volkswagen RNS 510** (toate versiunile hardware de la A/B/C până la P/Q/R)
* **Škoda Columbus**
* **SEAT Media System**

---

## 📚 Cuprins Documentație Wiki

Puteți naviga rapid către secțiunile dorite folosind ghidurile detaliate de mai jos:

| Ghid / Capitol | Descriere |
| :--- | :--- |
| 📖 [**Ghid Flashing & Scriere CD**](Ghid-Flashing-si-Scriere-CD) | Tutorial pas-cu-pas: tipuri de discuri recomandate, setări ImgBurn, secvența de butoane pentru intrare în modul SWL și pași de siguranță pe mașină. |
| 🔬 [**Specificații Tehnice & Reverse Engineering**](Specificatii-Tehnice-Reverse-Engineering) | Anatomia completă a fișierului `LOGO.FLI`, antetul de 64 octeți, formatul de culoare 15-bit RGB555 (`0RRRRRGGGGGBBBBB`), compresia RLE și sumele de control CRC-16/XMODEM. |
| 🎨 [**Ghid Web Studio & Simulator Hardware**](Ghid-Web-Studio) | Cum se pornește și se utilizează aplicația web modernă (Next.js), simularea în timp real a bordului RNS 510, iluminarea butoanelor OEM, grila de pixeli TFT și creatorul de insigne auto. |
| 🛠️ [**Depanare & Întrebări Frecvente (FAQ)**](Depanare-si-Intrebari-Frecvente-FAQ) | Rezolvarea erorilor uzuale (`SWL Error`, CD ejectat imediat, coduri de eroare unitate optică), compatibilitate versiuni hardware și recuperare de urgență. |

---

## 🌟 De ce a fost creat acest Toolkit?

Multe utilitare mai vechi apărute pe forumurile auto (create între anii 2011–2015) produceau imagini cu defecțiuni vizibile și riscuri tehnice:

1. **Purici Verzi Fluorescenți pe Fundaluri Negre:**
   * Scripturile vechi converteau greșit imaginile în formatul PC clasic **RGB565** (6 biți pentru verde) sau lăsau bitul 15 activat (`1`).
   * Placa grafică a navigației RNS 510 funcționează exclusiv în **RGB555 pe 15 biți**, unde bitul 15 este întotdeauna rezervat la `0`. Când bitul 15 era activ, procesorul grafic aprindea pixeli verzi paraziți pe ecran.
   * **Soluția Toolkit-ului:** Forțează strict bitul 15 pe `0` și aplică un filtru anti-zgomot care curăță micro-artefactele de compresie JPEG.

2. **Erori la actualizare (`SWL Error`):**
   * Lipsa recalculării sumei `CRC-16/XMODEM` pentru `ECUORDER.TXT` în fișierul `CRC.16` ducea la refuzul unității de a scrie discul.
   * **Soluția Toolkit-ului:** Calculează automat toți algoritmii de sumă de control la nivel de bit conform specificațiilor originale Siemens VDO / Continental.

3. **Interfață Web & Decompilator Local:**
   * Nu mai depinzi de site-uri terțe sau servere care pot dispărea. Ai atât aplicație desktop/consolă, cât și un **Web Studio** modern care rulează 100% local pe calculatorul tău.

---

## 🛡️ Siguranță Hardware Garantată

> [!IMPORTANT]
> Actualizarea imaginii de pornire scrie **EXCLUSIV în sectorul de memorie Flash 15 (`STRATA_UPDATE 15`)**.
> 
> Acest proces:
> * **NU** atinge hărțile de navigație de pe Hard Disk (HDD / SSD).
> * **NU** modifică codările mașinii (VCDS / OBD11 / CAN Gateway).
> * **NU** rescrie sistemul de operare de bază sau firmware-ul principal (radio / amplificator / gateway).
> * **NU** șterge muzica stocată sau contactele telefonice din memorie.

---

## 🚀 Pornire Rapidă (Quick Start)

Dacă dorești să creezi un disc în câteva secunde:
1. Trage o imagine (recomandat 800×480 px) peste fișierul **`create_bootable_iso.bat`**.
2. Scriptul generează automat fișierul `.iso` bootabil și o poză de control pixel-cu-pixel (`..._PREVIZUALIZARE_RNS510.png`).
3. Arde fișierul ISO pe un **CD-R** la viteză mică (4x sau 8x) folosind ImgBurn.
4. Introdu CD-ul în navigație conform [Ghidului de Flashing](Ghid-Flashing-si-Scriere-CD).

Pentru configurare avansată în browser cu simulare de bord, rulează **`start_web_studio.bat`**.
