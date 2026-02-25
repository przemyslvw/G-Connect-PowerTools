// content.js
console.log('Garmin PowerTools: Content Script Loaded in MAIN world');

let csrfToken = '';

// Zabezpieczenie: Przechwytywanie Fetch-a Garmina bezpośrednio w kontekście strony
const originalFetch = window.fetch;
window.fetch = async function (...args) {
    try {
        let token = null;
        if (args[0] && args[0].headers) {
            if (typeof args[0].headers.get === 'function') {
                token = args[0].headers.get('Connect-Csrf-Token') || args[0].headers.get('NK');
            }
        }

        if (!token && args[1] && args[1].headers) {
            const h = args[1].headers;
            if (typeof h.get === 'function') {
                token = h.get('Connect-Csrf-Token') || h.get('NK');
            } else if (typeof h === 'object') {
                token = h['Connect-Csrf-Token'] || h['connect-csrf-token'] || h['NK'] || h['nk'];
            }
        }

        if (token && token !== csrfToken && token !== 'NT' && token !== 'nt') {
            csrfToken = token;
            console.log('[PowerTools] Pomyślnie przechwycono token zabezpieczający CSRF (Fetch):', csrfToken);
        }
    } catch (e) {
        // ciche
    }
    return originalFetch.apply(this, args);
};

// Zabezpieczenie: Przechwytywanie XHR Garmina (starsze API)
const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if ((name.toLowerCase() === 'connect-csrf-token' || name.toLowerCase() === 'nk') && value && value !== 'NT') {
        if (value !== csrfToken) {
            csrfToken = value;
            console.log('[PowerTools] Pomyślnie przechwycono token zabezpieczający CSRF (XHR):', csrfToken);
        }
    }
    return origSetHeader.apply(this, arguments);
};
// -----------------------------------------------------------

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
        document.getElementById('pt-start-date').valueAsDate = new Date();

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
    // Proba wyciagniecia ID z kalendarza lub podstrony treningu
    let workoutId = null;

    const urlMatch = window.location.pathname.match(/workout\/(\d+)/);
    if (urlMatch) {
        workoutId = urlMatch[1];
    } else {
        const selects = document.querySelectorAll('select');
        for (let sel of selects) {
            if (sel.value && !isNaN(sel.value) && sel.options.length > 0) {
                workoutId = sel.value;
                break;
            }
        }
    }

    if (!workoutId || isNaN(workoutId)) {
        alert('Nie można znaleźć ID treningu.\nWejdź w zakładkę "Treningi" i wejdź na stronę konkretnego treningu przed zaplanowaniem.');
        return;
    }

    const headers = {
        'Content-Type': 'application/json',
        'di-backend': 'connectapi.garmin.com',
        'X-Requested-With': 'XMLHttpRequest'
    };

    if (csrfToken) {
        headers['Connect-Csrf-Token'] = csrfToken;
        headers['NK'] = 'NT';
    } else {
        console.warn('[PowerTools] Ostrzeżenie! Nie przechwycono tokena CSRF przed włączeniem bota. Próba znalezienia zapasowego...');
        headers['NK'] = 'NT';

        // Inna opcja ucieczki przed banem 403
        const localItems = { ...localStorage };
        for (let key in localItems) {
            if (key.toLowerCase().includes('csrf')) {
                headers['Connect-Csrf-Token'] = localItems[key];
                break;
            }
        }
    }

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
                console.warn(`[PowerTools] Trening na ${date} już istnieje (HTTP 409).`);
                errorCount++;
            } else if (response.status === 403) {
                console.error(`[PowerTools] Błąd 403! Nadal brak autoryzacji CSRF. Dodaj JEDEN trening ręcznie aby aktywować token pod spodem i spróbuj ponownie!`);
                errorCount++;
            } else {
                console.error(`[PowerTools] Błąd ${response.status} na datę ${date}`);
                errorCount++;
            }
        } catch (error) {
            console.error(`[PowerTools] Wyjątek podczas wysyłania:`, error);
            errorCount++;
        }

        await sleep(1000); // nie przeciazamy firewalla 1/sec
    }

    alert(`[PowerTools] Zakończono!\nDodano pomyślnie: ${successCount}\nPominięto/Błędy: ${errorCount}\n\nJeśli błędy wynosiły 403, dodaj ręcznie 1 dzień 'Zapisz' i dopiero użyj Zaplanuj (aktywuje to token).`);
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

    closePowerToolsModal();

    if (confirm(`Wygenerowano ${scheduledDates.length} terminów.\nCzy chcesz rozesłać te zapytania do kalendarza Garmin?`)) {
        await executeScheduling(scheduledDates);
    }
}

function injectCustomButton() {
    const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
    const addToCalendarBtn = buttons.find(b =>
    (b.innerText && (
        b.innerText.trim() === 'Dodaj do kalendarza' ||
        b.innerText.trim() === 'Zapisz' ||
        b.innerText.includes('Add to Calendar')
    ))
    );

    if (addToCalendarBtn) {
        if (!document.getElementById('powertools-schedule-btn')) {
            const ourBtn = document.createElement('button');
            ourBtn.id = 'powertools-schedule-btn';
            ourBtn.textContent = 'Zaplanuj cyklicznie (PowerTools)';

            ourBtn.className = addToCalendarBtn.className;

            const wrapperDiv = document.createElement('div');
            wrapperDiv.style.marginTop = '16px';
            wrapperDiv.appendChild(ourBtn);

            ourBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openPowerToolsModal();
            });

            const parentWrapper = addToCalendarBtn.parentNode;
            parentWrapper.parentNode.insertBefore(wrapperDiv, parentWrapper.nextSibling);

            console.log('[PowerTools] Przycisk schedule wstrzyknięty pomyślnie.');
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
