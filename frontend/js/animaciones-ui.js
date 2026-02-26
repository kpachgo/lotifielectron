(() => {
  const STYLE_ID = 'lotifi-animaciones-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .ani-reveal {
        opacity: 0;
        transform: translateY(12px);
        animation: lotifiReveal 420ms ease-out forwards;
      }

      .ani-card-hover {
        transition: transform 180ms ease, box-shadow 180ms ease;
      }

      .ani-card-hover:hover {
        transform: translateY(-3px);
        box-shadow: 0 14px 28px rgba(15, 23, 42, 0.14);
      }

      .ani-btn-pop {
        transition: transform 110ms ease;
      }

      .ani-btn-pop:active {
        transform: scale(0.97);
      }

      .ani-row-hover tbody tr {
        transition: background-color 140ms ease;
      }

      .ani-row-hover tbody tr:hover {
        background-color: rgba(14, 165, 233, 0.06);
      }

      .ani-row-enter {
        animation: lotifiRowEnter 220ms ease-out;
      }

      .ani-wizard-stepper {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        margin-bottom: 0.9rem;
      }

      .ani-wizard-pill {
        border: 1px solid #d6dfeb;
        background: #ffffff;
        color: #475569;
        border-radius: 999px;
        padding: 0.3rem 0.75rem;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 160ms ease;
      }

      .ani-wizard-pill.is-active {
        border-color: #0b57d0;
        background: #eaf1ff;
        color: #0b57d0;
      }

      .ani-wizard-pill.is-done {
        border-color: #98b6f0;
        background: #f2f7ff;
        color: #1d4ed8;
      }

      .ani-wizard-card {
        transition: filter 180ms ease, opacity 180ms ease, transform 180ms ease;
      }

      .ani-wizard-active {
        filter: none;
        opacity: 1;
        transform: scale(1);
        box-shadow: 0 14px 28px rgba(15, 23, 42, 0.14);
      }

      .ani-wizard-dim {
        filter: none;
        opacity: 0.65;
        transform: scale(0.994);
        background-color: #ecf3fe !important;
        box-shadow: none !important;
      }

      .ani-wizard-locked {
        pointer-events: none;
        user-select: none;
      }

      .ani-wizard-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.45rem;
        margin-bottom: 0.75rem;
      }

      @keyframes lotifiReveal {
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes lotifiRowEnter {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;

    document.head.appendChild(style);
  }

  function applyReveal() {
    const selectors = [
      '.card',
      '.table-responsive',
      '.navbar',
      'h3', 'h4', 'h5', 'h6',
      '.alert'
    ];

    const nodes = document.querySelectorAll(selectors.join(','));
    nodes.forEach((node, i) => {
      node.classList.add('ani-reveal');
      node.style.animationDelay = `${Math.min(i * 35, 360)}ms`;
    });
  }

  function applyCardHover() {
    document.querySelectorAll('.card').forEach((card) => {
      card.classList.add('ani-card-hover');
    });
  }

  function applyButtonPop() {
    document.querySelectorAll('.btn').forEach((btn) => {
      btn.classList.add('ani-btn-pop');
    });
  }

  function applyRowHover() {
    document.querySelectorAll('table').forEach((table) => {
      table.classList.add('ani-row-hover');
    });
  }

  function observeDynamicRows() {
    const bodies = document.querySelectorAll('table tbody');
    if (!bodies.length) return;

    bodies.forEach((tbody) => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            if (node.tagName !== 'TR') return;

            node.classList.add('ani-row-enter');
            window.setTimeout(() => {
              node.classList.remove('ani-row-enter');
            }, 260);
          });
        });
      });

      observer.observe(tbody, { childList: true });
    });
  }

  function hookGlobalFunction(name, afterCall) {
    let tries = 0;

    const timer = setInterval(() => {
      tries += 1;
      const fn = window[name];

      if (typeof fn === 'function' && !fn.__aniWizardWrapped) {
        const wrapped = async function wrappedFunction(...args) {
          const result = fn.apply(this, args);
          await Promise.resolve(result);
          afterCall();
          return result;
        };

        wrapped.__aniWizardWrapped = true;
        window[name] = wrapped;
        clearInterval(timer);
      }

      if (tries > 120) {
        clearInterval(timer);
      }
    }, 50);
  }

  function initContratosWizard() {
    const searchInput = document.getElementById('buscarClienteInput');
    const resultadosBody = document.getElementById('tablaResultadosCliente');
    const formContrato = document.getElementById('formContrato');
    const clienteHidden = document.getElementById('idClienteSeleccionado');

    if (!searchInput || !resultadosBody || !formContrato || !clienteHidden) {
      return;
    }

    const step1Card = searchInput.closest('.card');
    const step2Card = resultadosBody.closest('.card');
    const step3Card = formContrato.closest('.card');

    if (!step1Card || !step2Card || !step3Card) return;

    const cards = [step1Card, step2Card, step3Card];
    cards.forEach((card) => card.classList.add('ani-wizard-card'));

    const stepper = document.createElement('div');
    stepper.className = 'ani-wizard-stepper';
    stepper.innerHTML = `
      <button type="button" class="ani-wizard-pill" data-step="1">1. Busqueda</button>
      <button type="button" class="ani-wizard-pill" data-step="2">2. Resultados</button>
      <button type="button" class="ani-wizard-pill" data-step="3">3. Crear Contrato</button>
    `;
    step1Card.parentNode.insertBefore(stepper, step1Card);

    const step2Body = step2Card.querySelector('.card-body');
    const step3Body = step3Card.querySelector('.card-body');

    const actionsStep2 = document.createElement('div');
    actionsStep2.className = 'ani-wizard-actions';
    actionsStep2.innerHTML = `
      <button type="button" class="btn btn-sm btn-outline-secondary" data-wizard-back="1">
        Volver a Busqueda
      </button>
    `;
    step2Body.insertBefore(actionsStep2, step2Body.firstChild);

    const actionsStep3 = document.createElement('div');
    actionsStep3.className = 'ani-wizard-actions';
    actionsStep3.innerHTML = `
      <button type="button" class="btn btn-sm btn-outline-secondary" data-wizard-back="2">
        Cambiar Cliente
      </button>
    `;
    step3Body.insertBefore(actionsStep3, step3Body.firstChild);

    const state = {
      step: 1,
      maxReached: 1
    };

    function focusStep(step) {
      if (step === 1) {
        searchInput.focus();
        return;
      }

      if (step === 2) {
        const btnSeleccionar = resultadosBody.querySelector(
          'button[onclick*="seleccionarCliente"]'
        );
        if (btnSeleccionar) {
          btnSeleccionar.focus();
          return;
        }
        searchInput.focus();
        return;
      }

      if (step === 3) {
        const firstTarget =
          document.getElementById('selectLotificacion') ||
          document.getElementById('fechaInicio') ||
          formContrato;
        if (firstTarget && typeof firstTarget.focus === 'function') {
          firstTarget.focus();
        }
      }
    }

    function setStep(step, options = {}) {
      const desired = Math.max(1, Math.min(step, state.maxReached));
      state.step = desired;

      cards.forEach((card, idx) => {
        const current = idx + 1;
        const active = current === desired;
        card.classList.toggle('ani-wizard-active', active);
        card.classList.toggle('ani-wizard-dim', !active);
        card.classList.toggle('ani-wizard-locked', !active);
      });

      stepper.querySelectorAll('.ani-wizard-pill').forEach((pill) => {
        const n = Number(pill.dataset.step);
        pill.classList.toggle('is-active', n === desired);
        pill.classList.toggle('is-done', n < desired);
        pill.disabled = n > state.maxReached;
      });

      if (options.scroll !== false) {
        cards[desired - 1].scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }

      if (options.focus !== false) {
        focusStep(desired);
      }
    }

    function unlockStep(step) {
      state.maxReached = Math.max(state.maxReached, step);
    }

    stepper.addEventListener('click', (event) => {
      const pill = event.target.closest('.ani-wizard-pill');
      if (!pill) return;
      const step = Number(pill.dataset.step || 1);
      setStep(step);
    });

    document.addEventListener('click', (event) => {
      const backBtn = event.target.closest('[data-wizard-back]');
      if (!backBtn) return;
      const step = Number(backBtn.dataset.wizardBack || 1);
      setStep(step);
    });

    hookGlobalFunction('buscarCliente', () => {
      unlockStep(2);
      setStep(2);
    });

    hookGlobalFunction('seleccionarCliente', () => {
      unlockStep(3);
      setStep(3);
    });

    setStep(1, { scroll: false });
  }

  function initPagosWizard() {
    const buscarInput = document.getElementById('buscarClientePago');
    const codigoInput = document.getElementById('codigoLotePago');
    const tablaResultados = document.getElementById('tablaResultadosClientePago');
    const tablaContratos = document.getElementById('tablaContratosPago');
    const tablaEstado = document.getElementById('tablaEstadoCuenta');
    const formPago = document.getElementById('formPago');
    const formPagoMasivo = document.getElementById('formPagoMasivo');

    if (
      !buscarInput || !codigoInput || !tablaResultados ||
      !tablaContratos || !tablaEstado || !formPago || !formPagoMasivo
    ) {
      return;
    }

    const cardBusqueda = buscarInput.closest('.card');
    const cardRapido = codigoInput.closest('.card');
    const cardResultados = tablaResultados.closest('.card');
    const cardContratos = tablaContratos.closest('.card');
    const cardEstado = tablaEstado.closest('.card');
    const cardPago = formPago.closest('.card');
    const cardPagoMasivo = formPagoMasivo.closest('.card');

    if (
      !cardBusqueda || !cardRapido || !cardResultados ||
      !cardContratos || !cardEstado || !cardPago || !cardPagoMasivo
    ) {
      return;
    }

    const groups = {
      1: [cardBusqueda, cardRapido],
      2: [cardResultados],
      3: [cardContratos],
      4: [cardEstado],
      5: [cardPago, cardPagoMasivo]
    };

    const allCards = Array.from(
      new Set([
        cardBusqueda,
        cardRapido,
        cardResultados,
        cardContratos,
        cardEstado,
        cardPago,
        cardPagoMasivo
      ])
    );

    allCards.forEach((card) => card.classList.add('ani-wizard-card'));

    const stepper = document.createElement('div');
    stepper.className = 'ani-wizard-stepper';
    stepper.innerHTML = `
      <button type="button" class="ani-wizard-pill" data-step="1">1. Busqueda</button>
      <button type="button" class="ani-wizard-pill" data-step="2">2. Clientes</button>
      <button type="button" class="ani-wizard-pill" data-step="3">3. Contratos</button>
      <button type="button" class="ani-wizard-pill" data-step="4">4. Estado</button>
      <button type="button" class="ani-wizard-pill" data-step="5">5. Pago (Individual o Multiple)</button>
    `;
    cardBusqueda.parentNode.insertBefore(stepper, cardBusqueda);

    function addBackButton(card, toStep, label) {
      const body = card.querySelector('.card-body');
      if (!body) return;
      const actions = document.createElement('div');
      actions.className = 'ani-wizard-actions';
      actions.innerHTML = `
        <button type="button" class="btn btn-sm btn-outline-secondary" data-wizard-back-pagos="${toStep}">
          ${label}
        </button>
      `;
      body.insertBefore(actions, body.firstChild);
    }

    addBackButton(cardResultados, 1, 'Volver a Busqueda');
    addBackButton(cardContratos, 2, 'Volver a Clientes');
    addBackButton(cardEstado, 3, 'Volver a Contratos');
    addBackButton(cardPago, 4, 'Volver a Estado');
    addBackButton(cardPagoMasivo, 4, 'Volver a Estado');

    const state = {
      step: 1,
      maxReached: 1
    };

    function focusStep(step) {
      if (step === 1) {
        buscarInput.focus();
        return;
      }

      if (step === 2) {
        const btn = tablaResultados.querySelector('button');
        if (btn) btn.focus();
        return;
      }

      if (step === 3) {
        const btn = tablaContratos.querySelector('button');
        if (btn) btn.focus();
        return;
      }

      if (step === 4) {
        const btn = tablaEstado.querySelector('button');
        if (btn) btn.focus();
        return;
      }

      if (step === 5) {
        const input = document.getElementById('pagoMonto');
        if (input) input.focus();
        return;
      }
    }

    function setStep(step, options = {}) {
      const desired = Math.max(1, Math.min(step, state.maxReached));
      state.step = desired;

      allCards.forEach((card) => {
        const active = groups[desired].includes(card);
        card.classList.toggle('ani-wizard-active', active);
        card.classList.toggle('ani-wizard-dim', !active);
        card.classList.toggle('ani-wizard-locked', !active);
      });

      stepper.querySelectorAll('.ani-wizard-pill').forEach((pill) => {
        const n = Number(pill.dataset.step);
        pill.classList.toggle('is-active', n === desired);
        pill.classList.toggle('is-done', n < desired);
        pill.disabled = n > state.maxReached;
      });

      if (options.scroll !== false) {
        const firstCard = groups[desired][0];
        if (firstCard) {
          firstCard.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }

      if (options.focus !== false) {
        focusStep(desired);
      }
    }

    function unlockStep(step) {
      state.maxReached = Math.max(state.maxReached, step);
    }

    stepper.addEventListener('click', (event) => {
      const pill = event.target.closest('.ani-wizard-pill');
      if (!pill) return;
      const step = Number(pill.dataset.step || 1);
      setStep(step);
    });

    document.addEventListener('click', (event) => {
      const backBtn = event.target.closest('[data-wizard-back-pagos]');
      if (!backBtn) return;
      const step = Number(backBtn.dataset.wizardBackPagos || 1);
      setStep(step);
    });

    hookGlobalFunction('buscarClientePago', () => {
      unlockStep(2);
      setStep(2);
    });

    hookGlobalFunction('verContratosPago', () => {
      unlockStep(3);
      setStep(3);
    });

    hookGlobalFunction('seleccionarContratoPago', () => {
      unlockStep(4);
      unlockStep(5);
      setStep(4);
    });

    hookGlobalFunction('prepararPago', () => {
      unlockStep(5);
      setStep(5);
    });

    hookGlobalFunction('buscarPorCodigoLote', () => {
      unlockStep(4);
      unlockStep(5);
      setStep(4);
    });

    const formMasivoBtn = formPagoMasivo.querySelector('button[type="submit"]');
    if (formMasivoBtn) {
      formMasivoBtn.addEventListener('focus', () => {
        unlockStep(5);
        setStep(5, { scroll: false, focus: false });
      });
    }

    setStep(1, { scroll: false });
  }

  function init() {
    injectStyles();
    applyReveal();
    applyCardHover();
    applyButtonPop();
    applyRowHover();
    observeDynamicRows();
    initContratosWizard();
    initPagosWizard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
