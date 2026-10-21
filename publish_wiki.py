import os
import shutil
import subprocess
import sys
import tempfile

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def main():
    print("=================================================================")
    print("  Publicare Automată Wiki pe GitHub: RNS510-Bootlogo-Toolkit")
    print("=================================================================")

    # 1. Obținere token din Git Credential Manager
    p = subprocess.Popen(
        ['git', 'credential', 'fill'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    out, _ = p.communicate(input='protocol=https\nhost=github.com\n\n')

    token = None
    for line in out.splitlines():
        if line.startswith('password='):
            token = line.split('=', 1)[1].strip()

    if not token:
        print("[EROARE] Nu s-au putut extrage credențialele Git pentru github.com.")
        sys.exit(1)

    wiki_url = f"https://{token}@github.com/Edward03YT/RNS510-Bootlogo-Toolkit.wiki.git"

    # 2. Verificare dacă depozitul Wiki este alocat de GitHub
    print("-> Verificare stare Wiki pe GitHub...")
    check = subprocess.run(['git', 'ls-remote', wiki_url], capture_output=True, text=True)
    if check.returncode != 0:
        print("\n[ATENȚIE] GitHub nu a inițializat încă depozitul fizic de Wiki.")
        print("Mecanismul de securitate GitHub cere ca proprietarul să dea un singur click pe:")
        print("  👉 https://github.com/Edward03YT/RNS510-Bootlogo-Toolkit/wiki")
        print("și să apese pe 'Create the first page' (sau butonul verde 'Save page').")
        print("\nImediat după ce ai apăsat o singură dată 'Save page' în browser,")
        print("rulează din nou acest script, iar toate cele 7 pagini se vor publica automat!")
        return

    # 3. Clonare sau sincronizare fișiere în depozitul Wiki
    temp_dir = tempfile.mkdtemp()
    try:
        print(f"-> Clonare depozit Wiki în folder temporar...")
        clone_res = subprocess.run(['git', 'clone', wiki_url, temp_dir], capture_output=True, text=True)
        
        # Copiere fișiere din folderul local 'wiki'
        source_wiki = os.path.join(os.path.dirname(__file__), 'wiki')
        for item in os.listdir(source_wiki):
            s_path = os.path.join(source_wiki, item)
            d_path = os.path.join(temp_dir, item)
            if os.path.isfile(s_path):
                shutil.copy2(s_path, d_path)
                print(f"   [+] Copiat: {item}")

        # Git commit & push
        subprocess.run(['git', 'config', 'user.name', 'Edward03YT'], cwd=temp_dir, capture_output=True)
        subprocess.run(['git', 'config', 'user.email', 'igame0303@gmail.com'], cwd=temp_dir, capture_output=True)
        subprocess.run(['git', 'add', '.'], cwd=temp_dir, capture_output=True)
        subprocess.run(['git', 'commit', '-m', 'Docs: update complete wiki documentation (7 pages)'], cwd=temp_dir, capture_output=True)

        print("-> Trimitere (git push) pe serverul GitHub Wiki...")
        push_res = subprocess.run(['git', 'push', 'origin', 'master'], cwd=temp_dir, capture_output=True, text=True)
        if push_res.returncode == 0:
            print("\n[SUCCES] Toate paginile Wiki au fost publicate cu succes pe GitHub!")
            print("Le poți vizualiza acum la:")
            print("👉 https://github.com/Edward03YT/RNS510-Bootlogo-Toolkit/wiki")
        else:
            print("[EROARE la push]:", push_res.stderr)
    finally:
        def on_rm_error(func, path, exc_info):
            import stat
            os.chmod(path, stat.S_IWRITE)
            func(path)
        shutil.rmtree(temp_dir, onerror=on_rm_error)

if __name__ == "__main__":
    main()
