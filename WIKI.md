# 🚗 VW RNS 510 Bootlogo Toolkit — Index Wiki & Ghid Complet

Acest fișier centralizează documentația completă a proiectului **VW RNS 510 Bootlogo Toolkit**, creat și întreținut de **Edward03**.

> 💡 **Pentru utilizarea cu GitHub Wiki:** Toate paginile individuale, inclusiv bara laterală (`_Sidebar.md`) și subsolul (`_Footer.md`), se regăsesc în folderul [`wiki/`](wiki/). Le poți încărca direct în tab-ul de Wiki al depozitului tău GitHub.

---

## 📑 Navigare Rapidă

1. [📖 Ghid Flashing & Scriere CD](wiki/Ghid-Flashing-si-Scriere-CD.md)
2. [🔬 Specificații Tehnice & Reverse Engineering](wiki/Specificatii-Tehnice-Reverse-Engineering.md)
3. [🎨 Ghid Web Studio & Simulator Hardware](wiki/Ghid-Web-Studio.md)
4. [🛠️ Depanare & Întrebări Frecvente (FAQ)](wiki/Depanare-si-Intrebari-Frecvente-FAQ.md)

---

## 🌟 Rezumatul Funcționalităților Toolkit-ului

* **Fără Purici Verzi pe Negru:** Encodare nativă **15-bit RGB555** cu bitul 15 curățat pe `0` și filtru anti-zgomot JPEG.
* **Compresie RLE Nativă Big-Endian:** Conformă 100% cu specificațiile originale Siemens VDO / Continental.
* **Calcul Automat CRC-16/XMODEM:** Sumele de control CRC1, CRC2 și fișierul `CRC.16` pentru `ECUORDER.TXT` sunt calculate matematic exact.
* **Simulator Web Interactiv (Next.js):** Cockpit RNS 510 realist, iluminare butoane OEM roșie, grilă TFT, comparație split original vs hardware și galerie de modele auto.
* **Decompilator & Inspector ISO/FLI:** Verifică orice fișier `.iso` sau `.fli` înainte de scriere pentru a preveni erorile `SWL Error`.
* **Siguranță Hardware Totală:** Scrie exclusiv în sectorul de memorie Flash 15 (`STRATA_UPDATE 15`). Nu atinge hărțile HDD, codările radio (VCDS) sau sistemul de operare.

---

<div align="center">
  <p><b>VW RNS 510 Bootlogo Toolkit</b> • Întreținut de <b>Edward03</b></p>
  <p><small>Licențiat sub GNU General Public License v3.0</small></p>
</div>
