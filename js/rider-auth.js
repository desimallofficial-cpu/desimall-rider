const RiderAuth = {
  key: 'desimall_rider_session',

  init() {
    const lt = document.getElementById('loginTab');
    const rt = document.getElementById('registerTab');
    const lf = document.getElementById('loginForm');
    const rf = document.getElementById('registerForm');

    lt.onclick = () => {
      lt.classList.add('active');
      rt.classList.remove('active');
      lf.classList.remove('hidden');
      rf.classList.add('hidden');
      this.msg('');
    };

    rt.onclick = () => {
      rt.classList.add('active');
      lt.classList.remove('active');
      rf.classList.remove('hidden');
      lf.classList.add('hidden');
      this.msg('');
    };

    lf.onsubmit = e => {
      e.preventDefault();
      this.login();
    };

    rf.onsubmit = e => {
      e.preventDefault();
      this.register();
    };

    const togglePassword = (buttonId, inputId) => {
      const btn = document.getElementById(buttonId);
      const input = document.getElementById(inputId);
      if (!btn || !input) return;
      btn.onclick = () => {
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        btn.textContent = showing ? 'Show' : 'Hide';
        btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      };
    };

    togglePassword('showLoginPassword', 'password');
    togglePassword('showRegisterPassword', 'rPassword');

    const forgotBtn = document.getElementById('forgotPasswordBtn');
    const forgotNote = document.getElementById('forgotPasswordNote');
    if (forgotBtn && forgotNote) {
      forgotBtn.onclick = () => {
        forgotNote.classList.toggle('show');
      };
    }

    const remember = document.getElementById('rememberRider');
    const identifier = document.getElementById('identifier');
    try {
      const remembered = localStorage.getItem('desimall_rider_identifier') || '';
      if (remembered && identifier) {
        identifier.value = remembered;
        if (remember) remember.checked = true;
      }
    } catch (_) {}

    this.check();
  },

  read() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || {};
    } catch (_) {
      return {};
    }
  },

  msg(text, good = false) {
    const el = document.getElementById('msg');
    el.textContent = text;
    el.classList.toggle('good', good);
  },

  async check() {
    const s = this.read();
    if (!s.token && !s.refreshToken) return;

    try {
      const r = await DesiMallAPI.riderSession(s.token || '');
      if (r?.success) location.replace('dashboard.html');
    } catch (_) {}
  },

  async login() {
    const btn = document.querySelector('#loginForm button');
    btn.disabled = true;

    try {
      const r = await DesiMallAPI.riderLogin({
        Identifier: document.getElementById('identifier').value.trim(),
        Password: document.getElementById('password').value
      });

      localStorage.setItem(
        this.key,
        JSON.stringify({
          token: r.token,
          refreshToken: r.refreshToken || r.session?.refresh_token || '',
          expiresAt: r.expiresAt || r.session?.expires_at || null,
          rider: r.rider
        })
      );

      try {
        const remember = document.getElementById('rememberRider');
        const identifier = document.getElementById('identifier')?.value.trim() || '';
        if (remember?.checked && identifier) {
          localStorage.setItem('desimall_rider_identifier', identifier);
        } else {
          localStorage.removeItem('desimall_rider_identifier');
        }
      } catch (_) {}

      location.replace('dashboard.html');
    } catch (error) {
      const rawMessage = String(error?.message || '').trim().toLowerCase();
      const status = Number(error?.status || 0);

      const invalidCredentials =
        status === 400 ||
        status === 401 ||
        rawMessage.includes('invalid login credentials') ||
        rawMessage.includes('invalid credentials') ||
        rawMessage.includes('wrong password') ||
        rawMessage.includes('incorrect password');

      this.msg(
        invalidCredentials
          ? 'Wrong / invalid password. Please enter a valid password.'
          : (error?.message || 'Rider login failed. Please try again.')
      );
    } finally {
      btn.disabled = false;
    }
  },

  async register() {
    const btn = document.querySelector('#registerForm button');
    btn.disabled = true;

    try {
      const r = await DesiMallAPI.riderRegister({
        RiderName: rName.value.trim(),
        Mobile: rMobile.value.trim(),
        Email: rEmail.value.trim(),
        VehicleType: rVehicle.value,
        VehicleNumber: rVehicleNo.value.trim(),
        ServicePincode: rPincode.value.trim(),
        Password: rPassword.value
      });

      this.msg(r.message || 'Registration submitted.', true);
      if (r.success) registerForm.reset();
    } catch (error) {
      this.msg(error?.message || 'Registration failed');
    } finally {
      btn.disabled = false;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => RiderAuth.init());
