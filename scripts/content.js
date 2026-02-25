// content.js
console.log('Garmin PowerTools: Content Script Loaded');

function createPowerToolsModal() {
    const modalHTML = `
        <div id="powertools-modal-backdrop" class="powertools-modal-backdrop" style="display: none;">
            <div class="powertools-modal">
                <div class="powertools-modal-header">
                    <h3>Zaplanuj cyklicznie (PowerTools)</h3>
                    <button id="powertools-close-btn">&times;</button>
                </div>
                <div class="powertools-modal-body">
                    <div class="powertools-form-group">
                        <label for="pt-start-date">Data startu:</label>
                        <input type="date" id="pt-start-date" required>
                    </div>
                    <div class="powertools-form-group">
                        <label for="pt-frequency">Częstotliwość (dni):</label>
                        <input type="number" id="pt-frequency" min="1" value="7" required>
                    </div>
                    <div class="powertools-form-group">
                        <label for="pt-end-date">Data końca:</label>
                        <input type="date" id="pt-end-date" required>
                    </div>
                </div>
                <div class="powertools-modal-footer">
                    <button id="powertools-submit-btn" class="powertools-btn powertools-btn-primary">Zaplanuj</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('powertools-close-btn').addEventListener('click', closePowerToolsModal);
    document.getElementById('powertools-submit-btn').addEventListener('click', submitPowerToolsModal);
}

function openPowerToolsModal() {
    const backdrop = document.getElementById('powertools-modal-backdrop');
    if (backdrop) {
        backdrop.style.display = 'flex';
        // Set default start date to today
        document.getElementById('pt-start-date').valueAsDate = new Date();

        // Default end date to 1 month from now
        let endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);
        document.getElementById('pt-end-date').valueAsDate = endDate;
    }
}

function closePowerToolsModal() {
    const backdrop = document.getElementById('powertools-modal-backdrop');
    if (backdrop) {
        backdrop.style.display = 'none';
    }
}

function generateDates(startDateStr, frequencyDays, endDateStr) {
    const dates = [];
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const freq = parseInt(frequencyDays, 10);

    let current = new Date(start);
    // Zabezpieczenie przed pętlą nieskończoną
    if (freq <= 0) return dates;

    while (current <= end) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);

        current.setDate(current.getDate() + freq);
    }
    return dates;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function executeScheduling(dates) {
    // ID treningu można pobrać z URL: np. https://connect.garmin.com/modern/workout/1485547083
    const urlParts = window.location.pathname.split('/');
    const workoutId = urlParts[urlParts.length - 1];

    if (!workoutId || isNaN(workoutId)) {
        alert('Nie udało się pobrać ID treningu z URL. Upewnij się, że jesteś na stronie pojedynczego treningu.');
        return;
    }

    // Garmin Czasem wymaga konkretnego CSRF. Przyjęta taktyka u użytkownika to nagłówek NK: NT
    const headers = {
        'Content-Type': 'application/json',
        'NK': 'NT', // Popularny bypass anti-csrf Garmina opisany przez usera
        'di-backend': 'connectapi.garmin.com',
        'X-Requested-With': 'XMLHttpRequest'
    };

    // Próba wydobycia lokalnego CSRF jeśli istnieje w localStorage (np. GARMIN-SSO-CUST-GUID albo Connect-Csrf-Token)
    // Jednak polegamy głównie na NK: NT jako header bypass
    // W nagłówkach w request.txt widać pole Connect-Csrf-Token

    let successCount = 0;
    let errorCount = 0;

    for (const date of dates) {
        console.log(`[PowerTools] Planowanie na ${date}...`);
        try {
            const response = await fetch(`https://connect.garmin.com/gc-api/workout-service/schedule/${workoutId}`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ date: date })
            });

            if (response.ok) {
                console.log(`[PowerTools] Sukces: ${date}`);
                successCount++;
            } else if (response.status === 409) {
                console.warn(`[PowerTools] Trening na ${date} już istnieje w kalendarzu (HTTP 409).`);
                errorCount++;
            } else {
                console.error(`[PowerTools] Błąd ${response.status} na datę ${date}`);
                errorCount++;
            }
        } catch (error) {
            console.error(`[PowerTools] Wyjątek podczas wysyłania zapytania na ${date}:`, error);
            errorCount++;
        }

        // Rate-limiting po każdym strzale - 1000ms by uniknąć zablokowania
        await sleep(1000);
    }

    alert(`[PowerTools] Zakończono!\\nDodano pomyślnie: ${successCount}\\nPominięto/Błędy (np. już istnieje): ${errorCount}`);
}

async function submitPowerToolsModal() {
    const startDate = document.getElementById('pt-start-date').value;
    const frequency = document.getElementById('pt-frequency').value;
    const endDate = document.getElementById('pt-end-date').value;

    if (!startDate || !frequency || !endDate) {
        alert('Wypełnij wszystkie pola formularza.');
        return;
    }

    const scheduledDates = generateDates(startDate, frequency, endDate);
    if (scheduledDates.length === 0) {
        alert('Zweryfikuj daty (data końca mniejsza od daty startowej?).');
        return;
    }

    console.log('[PowerTools] Wygenerowane daty:', scheduledDates);

    // Zamykamy modal przed procesowaniem
    closePowerToolsModal();

    // Wywołanie logiki API
    const confirmMsg = `Wygenerowano ${scheduledDates.length} terminów.\\nCzy chcesz rozesłać te zapytania do kalendarza Garmin?`;
    if (confirm(confirmMsg)) {
        await executeScheduling(scheduledDates);
    }
}

function injectCustomButton() {
    // Look for button with text "Dodaj do kalendarza" or "Add to Calendar"
    const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
    const addToCalendarBtn = buttons.find(b =>
        (b.innerText && (b.innerText.includes('Dodaj do kalendarza') || b.innerText.includes('Add to Calendar')))
    );

    if (addToCalendarBtn) {
        if (!document.getElementById('powertools-schedule-btn')) {
            const ourBtn = document.createElement('button');
            ourBtn.id = 'powertools-schedule-btn';
            ourBtn.textContent = 'Zaplanuj cyklicznie (PowerTools)';
            ourBtn.className = addToCalendarBtn.className;

            ourBtn.style.marginLeft = '10px';
            ourBtn.style.backgroundColor = '#007cc3';
            ourBtn.style.color = '#fff';

            ourBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openPowerToolsModal();
            });

            addToCalendarBtn.parentNode.insertBefore(ourBtn, addToCalendarBtn.nextSibling);
            console.log('Garmin PowerTools: Custom schedule button injected.');
        }
    }
}

function init() {
    if (!document.getElementById('powertools-modal-backdrop')) {
        createPowerToolsModal();
    }

    const observer = new MutationObserver((mutations) => {
        injectCustomButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
