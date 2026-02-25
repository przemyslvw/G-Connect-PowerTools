Plan wdrożenia basic

Krok 1: Rekonesans API i analiza żądania (Faza Ręczna)
To najważniejszy etap. Zanim napiszemy linijkę kodu wtyczki, musimy dokładnie zrozumieć, z czym rozmawia frontend.

Uruchomienie proxy/nasłuchu: Odpalasz Burp Suite (lub zakładkę Network w DevTools przeglądarki).

Wykonanie akcji wzorcowej: Wchodzisz w Garmin Connect, wybierasz swój "Trening siłowy Poniedziałek" i ręcznie dodajesz go do kalendarza na jedną konkretną datę.

Przechwycenie i analiza ruchu: W logach HTTP szukasz żądania POST, które poleciało po kliknięciu "Zapisz".

Analiza URL: Identyfikujemy endpoint (prawdopodobnie coś w stylu /workout-service/schedule/{id}).

Analiza Payloadu: Sprawdzamy Request Body. Zazwyczaj to prosty JSON: {"date": "2026-02-23"}.

Analiza Zabezpieczeń (Headers): To kluczowe. Sprawdzamy, jak Garmin autoryzuje żądanie. Oprócz ciasteczek sesyjnych, musimy zlokalizować tokeny Anti-CSRF (w Garminie to często nagłówek NK: NT lub di-backend).

Weryfikacja w izolacji (Proof of Concept): Wrzucasz to żądanie do Repeatera w Burpie (lub kopiujesz jako fetch w konsoli DevTools), zmieniasz datę w JSON-ie na inny dzień i wysyłasz. Jeśli trening pojawił się w kalendarzu, masz 100% pewności, co musisz zautomatyzować.

Krok 2: Setup struktury projektu i Manifest V3
Zamiast wrzucać wszystko do jednego pliku, od razu nadamy projektowi profesjonalną strukturę gotową na kolejne moduły.

Tworzymy plik manifest.json (w standardzie Manifest V3), definiując uprawnienia. Wystarczą nam host_permissions tylko dla *://connect.garmin.com/* oraz scripting.

Tworzymy szkielet katalogów:

/icons/ (grafiki wtyczki)

/scripts/ (skrypty wstrzykiwane, np. content.js, api-client.js)

/ui/ (pliki HTML/CSS dla ewentualnych okienek pop-up)

Krok 3: Integracja z UI (Content Script i DOM Manipulation)
Przechodzimy do integracji z interfejsem użytkownika Garmin Connect, który jest aplikacją typu SPA (Single Page Application).

Obserwacja zmian (MutationObserver): Skrypt content.js nasłuchuje zmian w drzewie DOM, czekając, aż użytkownik kliknie i otworzy modal z detalami treningu.

Wstrzyknięcie przycisku: Gdy modal się pojawi, nasz skrypt "podpina" się obok natywnego przycisku "Dodaj do kalendarza" i wstrzykuje nowy: "Zaplanuj cyklicznie (PowerTools)".

Modal interakcji: Po kliknięciu w nasz przycisk, wyświetlamy prosty, stworzony przez nas mini-formularz, w którym użytkownik wybiera: datę startu, częstotliwość (np. co 7 dni) i datę końca (lub liczbę powtórzeń).

Krok 4: Logika generowania dat i egzekucja
Mamy już dane wejściowe od użytkownika, czas na logikę biznesową.

Generator dat: Piszemy funkcję w JavaScript, która na podstawie inputu od użytkownika generuje tablicę stringów w formacie oczekiwanym przez API Garmina (np. ['2026-03-02', '2026-03-09', ...]).

Pętla z uwzględnieniem Rate-Limitingu: To tu wychodzi doświadczenie z automatyzacji. Nie wysyłamy 50 żądań fetch na raz, bo WAF (Web Application Firewall) Garmina odetnie nam sesję. Piszemy asynchroniczną pętlę (for...of z opóźnieniem await sleep(1000)), która iteruje po datach.

Wysyłka i nagłówki: Nasz skrypt wywołuje zapytania fetch bezpośrednio z kontekstu przeglądarki, dołączając nagłówki Anti-CSRF zidentyfikowane w Kroku 1. Przeglądarka sama zatroszczy się o dodanie ciasteczek uwierzytelniających.

Obsługa odpowiedzi: Logujemy sukces lub wyłapujemy błędy (np. kod HTTP 409, jeśli w dany dzień trening już istnieje).

Krok 5: Secure Code Review i testy
Przed wypchnięciem kodu na GitHuba weryfikujemy jego jakość.

Upewniamy się, że w kodzie nie ma żadnych zewnętrznych zależności (CDN-ów) ani zapytań do zewnętrznych serwerów – pełna izolacja i gwarancja prywatności dla użytkowników.