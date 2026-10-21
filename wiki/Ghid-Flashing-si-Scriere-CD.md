# 📖 Ghid Complet: Scrierea CD-ului și Procedura de Flashing pe Mașină

Acest ghid oferă instrucțiunile oficiale, testate pas cu pas, pentru transferul siglei de pornire pe unitatea de navigație **Volkswagen RNS 510**, **Škoda Columbus** sau **SEAT Media System**.

---

## 💿 Pasul 1: Alegerea Mediului de Stocare (CD-R)

Calitatea discului optic este factorul #1 pentru un update reușit pe RNS 510. Lentilele laser ale unităților RNS 510 au toleranțe optice foarte stricte.

### ✅ Ce TREBUIE să folosești:
* **CD-R de calitate superioară** (Recomandat cu căldură: **Verbatim AZO** / **Sony Datalife** / **TDK**).
* Discuri noi, fără zgârieturi, amprente sau praf.

### ❌ Ce NU TREBUIE să folosești:
* **CD-RW (rescriabil):** Rata de reflexie este mult prea mică; unitatea va da `CD/DVD Error`.
* **DVD-R / DVD+R / DVD-RW:** Scriptul de bootloader caută sistemul de fișiere pe mediul CD (`//cddos/...`).
* **Stick USB sau Card SD:** RNS 510 nu suportă actualizarea sectorului 15 de bootlogo prin slotul de card SD sau MDI-USB; doar unitatea optică CD este activă în modul de boot SWL.

---

## 🔥 Pasul 2: Scrierea Imaginii ISO pe Disc

Recomandăm utilizarea utilitarului gratuit **[ImgBurn](https://www.imgburn.com/)** (sau **CDBurnerXP**):

1. Deschide **ImgBurn** și selectează opțiunea:
   > **`Write image file to disc`** (Scriere fișier imagine pe disc).
2. La secțiunea **Source**, apasă pe iconița cu folder și selectează fișierul `.iso` generat de toolkit.
3. La secțiunea **Settings**:
   * **Write Speed (Viteza de scriere):** Selectează **`4x`** sau **`8x`** (sau cea mai mică viteză suportată de inscriptorul tău CD).
   * **Bifează `Verify`** (Verificare după scriere).
4. Apasă butonul mare de scriere. Așteaptă până când discul este scris și verificat cu succes 100%.

> [!TIP]
> Nu scrie discul la viteze mari (16x, 24x, 52x)! Vitezele mari generează fluctuații de adâncime pe pistele optice pe care laserul navigației nu le va putea citi uniform.

---

## 🚗 Pasul 3: Pregătirea Vehiculului

1. Deschide mașina și introdu cheia în contact.
2. Pune contactul motorului (fără a porni neapărat motorul), sau dacă bateria este mai slabă, pornește motorul sau conectează un redresor stabilizat.
3. Asigură-te că mașina nu va intra în modul de economisire energie (*Sleep Mode / Transport Mode*) în următoarele 5 minute.
4. Scoate orice disc existent deja în unitatea de navigație (apasă butonul `EJECT ⏏`).

---

## 🕹️ Pasul 4: Declanșarea Modului SWL (Software Loading)

Pentru a forța navigația să intre în modul de programare flash:

1. Pornește navigația RNS 510 apăsând butonul rotativ stânga de pornire.
2. Apasă și ține apăsat **SIMULTAN** combinația hardware de 3 butoane din partea de sus a ramei:
   * **`SETUP`** + **`EJECT (⏏)`** + **`MIC (🎤)`** (pe unitățile mai noi cu comandă vocală)
   * sau **`SETUP`** + **`EJECT (⏏)`** + **`INFO (i)`** (pe unitățile fabricate până în 2009-2010)

3. Ține butoanele apăsate timp de 2-3 secunde până când ecranul se stinge complet și auzi un mic clic (reboot forțat).
4. Eliberează butoanele. Unitatea va porni într-un ecran special alb/gri de actualizare:
   > **`Software Loading CD`** / **`SWL Initializing...`**

---

## 📥 Pasul 5: Introducerea Discului și Flashing-ul

1. Când ecranul îți cere discul de actualizare (sau imediat ce se inițializează ecranul de bootloader), introdu CD-ul ars în fanta navigației.
2. Unitatea va trage discul și va citi fișierele de configurare:
   * Va apărea titlul personalizat (ex: `Edward03 Bootlogo Updater`).
   * Va fi afișată data și versiunea din `VERSION.TXT`.
3. O bară de progres orizontală va începe să se umple:
   * Unitatea rescrie conținutul din `WA/LOGO.FLI` direct în memoria Flash Partition 15 (`STRATA_UPDATE 15`).
   * **Timpul total de scriere este de aproximativ 1 minut și jumătate până la 2 minute**.
4. La finalul scrierii:
   * Unitatea va emite un beep sau va afișa mesajul `SUCCESS` / `UPDATE FINISHED`.
   * **CD-ul va fi ejectat automat din unitate**.
5. Scoate CD-ul din fantă.
6. Unitatea se va restarta automat. Imediat la repornire, noul tău logo personalizat va străluci pe ecranul mașinii! 🎉
