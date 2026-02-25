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

function submitPowerToolsModal() {
    const startDate = document.getElementById('pt-start-date').value;
    const frequency = document.getElementById('pt-frequency').value;
    const endDate = document.getElementById('pt-end-date').value;

    console.log('PowerTools - zebrane dane:', { startDate, frequency, endDate });
    alert('Dane zebrane. Logika API (Krok 4) będzie tu wykonywana.\\n\\nStart: ' + startDate + '\\nCo: ' + frequency + ' dni\\nKoniec: ' + endDate);

    closePowerToolsModal();
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

            // Adding a few inline styles to make it stand out or fit right in case class copying isn't enough
            ourBtn.style.marginLeft = '10px';
            ourBtn.style.backgroundColor = '#007cc3'; // Garmin's typical blue
            ourBtn.style.color = '#fff';

            ourBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openPowerToolsModal();
            });

            // Insert it next to the found button
            addToCalendarBtn.parentNode.insertBefore(ourBtn, addToCalendarBtn.nextSibling);
            console.log('Garmin PowerTools: Custom schedule button injected.');
        }
    }
}

// Initialization and MutationObserver
function init() {
    if (!document.getElementById('powertools-modal-backdrop')) {
        createPowerToolsModal();
    }

    const observer = new MutationObserver((mutations) => {
        // Try to inject the button anytime DOM changes, because Garmin is a SPA.
        // `injectCustomButton` already checks if button exists to avoid duplicates.
        injectCustomButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// Start watching when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
