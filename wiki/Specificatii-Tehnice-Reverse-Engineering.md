# 🔬 Specificații Tehnice & Inginerie Inversă (Reverse Engineering)

Acest document conține specificațiile de nivel binar și arhitectura fișierelor utilizate de procesorul grafic și sistemul de operare de pe **Volkswagen RNS 510** (Continental / Siemens VDO) pentru ecranul de pornire.

---

## 📐 1. Formatul Binar al Fișierului `LOGO.FLI`

Fișierul `LOGO.FLI` este compus din două părți:
1. **Antet binar fix de 64 octeți** (0x40).
2. **Flux de date comprimat RLE (Run-Length Encoded)** în format Big-Endian.

### Tabel Structură Antet (64 Octeți)

```text
Offset    Lungime   Tip Date        Valoare / Câmp               Descriere
------------------------------------------------------------------------------------------------------------------
0x00      4 octeți  uint32_be       0xAA55AA55                  Semnătură Magică de recunoaștere hardware
0x04      4 octeți  uint32_be       CRC1 Antet                   CRC-16/XMODEM calculat pentru octeții 0x08..0x3F
0x08      4 octeți  uint32_be       0x00000320 (800)            Lățimea imaginii în pixeli
0x0C      4 octeți  uint32_be       0x000001E0 (480)            Înălțimea imaginii în pixeli
0x10      4 octeți  uint32_be       CRC2 Date                    CRC-16/XMODEM calculat pentru fluxul RLE complet
0x14      4 octeți  uint32_be       0x000BB800 (768.000)        Mărime necomprimată (800 × 480 × 2 octeți/pixel)
0x18      4 octeți  uint32_be       0x00000001                  Indicator format (1 = RLE RGB555)
0x1C      4 octeți  uint32_be       0x00000040 (64)             Mărimea antetului în octeți
0x20..3F  32 octeți octeți nuli     0x00...0x00                 Padding aliniere memorie Flash (32 octeți de zero)
```

---

## 🎨 2. Spațiul de Culoare: 15-Bit RGB555 (Nativ Hardware)

Unitatea RNS 510 **nu suportă RGB565 pe 16 biți**. Controlerul TFT utilizează exclusiv spațiul de culoare **RGB555 pe 15 biți**, încapsulat într-un cuvânt de 16 biți:

```text
Bit:    15  14 13 12 11 10   9  8  7  6  5   4  3  2  1  0
        --  --------------   -------------   -------------
Nivel:  0   R  R  R  R  R    G  G  G  G  G   B  B  B  B  B
        ^   ==============   =============   =============
        |      5 biți Roșu    5 biți Verde   5 biți Albastru
        |
        +---> Bitul 15 TREBUIE să fie întotdeauna 0!
```

### Formula de Conversie din sRGB 24-bit (888):
```python
r5 = (r8 >> 3) & 0x1F  # 0..31
g5 = (g8 >> 3) & 0x1F  # 0..31
b5 = (b8 >> 3) & 0x1F  # 0..31

# Bitul 15 este garantat 0 prin mascare cu 0x7FFF
rgb555 = ((r5 << 10) | (g5 << 5) | b5) & 0x7FFF
```

### 🦠 Misterul „Puricilor Verzi” Rezolvat:
* În scripturile vechi neoficiale, conversia folosea algoritmul generic de PC: `((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)`.
* Deoarece canalul verde primea 6 biți (0..63) în loc de 5 biți (0..31), bitul 15 era frecvent aprins ca `1`, sau biții inferiori ai verdelui debordau pe canalul albastru.
* Procesorul grafic RNS 510 interpreta bitul 15 fie ca o anomalie de sincronizare GPU, fie ca o saturație pe canalul verde, rezultând celebrele puncte verzi pe fundal negru.
* **Algoritmul Anti-Purici din acest Toolkit:**
  1. Forțează bitul 15 pe `0` în mod strict (`& 0x7FFF`).
  2. Implementează un filtru inteligent de podea neagră (*black-floor clamping*): pixelii cu luminozitate parazită reziduală generată de compresia JPEG (`R < 12, G < 12, B < 12`) sunt asimilați automat ca negru pur `0x0000`.

---

## 📦 3. Compresia RLE (Run-Length Encoding)

După primii 64 de octeți ai antetului, fluxul de date conține secvențe comprimate RLE. Fiecare secvență are o lungime fixă de **4 octeți** (Big-Endian):

```text
Octet 0-1 (uint16_be):  Culoarea pixelului (format RGB555)
Octet 2-3 (uint16_be):  Numărul de repetiții consecutive ale acestui pixel (1..65535)
```

* **Ordinea de scanare:** De la stânga la dreapta, linie cu linie, de sus în jos.
* **Verificare de integritate:** Suma tuturor valorilor de repetiție din fișier trebuie să fie egală cu exact **384.000 pixeli** (800 × 480).

---

## 🔐 4. Algoritmii de Sumă de Control (CRC-16/XMODEM)

Toate calculele de integritate din pachet folosesc standardul **CRC-16/XMODEM** (cunoscut și sub denumirea de CRC-CCITT fără inversare):
* **Polinom generator:** `0x1021` ($x^{16} + x^{12} + x^5 + 1$)
* **Valoare inițială:** `0x0000`
* **Reflecție intrare/ieșire:** `False`
* **XOR Final:** `0x0000`

### Unde este aplicat:
1. **`CRC1` (Antet FLI, offset 0x04):** Calculat peste octeții `0x08` până la `0x3F` (56 octeți).
2. **`CRC2` (Antet FLI, offset 0x10):** Calculat peste întregul corp RLE (de la octetul 64 până la sfârșitul fișierului).
3. **`CRC.16` (Rădăcina discului ISO):** Calculat peste conținutul exact al fișierului text `ECUORDER.TXT`.

---

## 💽 5. Structura Sistemului de Fișiere ISO 9660 SWL

Discul ISO bootabil conține o structură strictă necesară procesului de Software Loading:

```text
/
├── BLSCRIPT.CFG                                  # Script de bootloader (afișează bara de progres și textul pe ecran)
├── CRC.16                                        # Text 4-char hex cu suma CRC-16 a fișierului ECUORDER.TXT
├── DIR.INF                                       # Descriptor de directoare
├── ECUORDER.TXT                                  # Comenzi de scriere Flash NAND/NOR pentru sistemul SWL
├── VERSION.TXT                                   # Metadate versiune (Autor, Data, Cod SW)
├── WA/
│   └── LOGO.FLI                                  # Imaginea grafică generată (800x480 RGB555 RLE)
└── SWL/
    └── SILVER_1/
        └── RNSMIDEC/
            └── SWL/
                └── SWL.FLI                       # Imagine de execuție a utilitarului de scriere Flash
```

### Ce conține `ECUORDER.TXT`:
```text
SHOW_SCREEN 0 1 SWL_SCREEN_VERSION
STRATA_UPDATE 15 <dimensiune_fli> /cddos/WA/LOGO.FLI
RESTART_SYSTEM
FINISHED_DOWNLOAD
```
Comanda `STRATA_UPDATE 15` îi dictează procesorului de pe RNS 510 să copieze fișierul `LOGO.FLI` de pe CD exclusiv în **Partiția 15 a memoriei StrataFlash**, lăsând restul de 14 partiții (sistem de operare, fișiere de hărți, coduri de securitate) complet neatinse.
