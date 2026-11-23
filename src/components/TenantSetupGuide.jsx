import React, { useState } from 'react';
import {
  BookOpen,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  ShieldCheck,
  Info,
  CheckCircle2,
  Circle,
  RotateCcw,
} from 'lucide-react';
// Loaded straight from the repo so the guide always shows the real scripts.
import tenantTemplateSql from '../../supabase/supabase_tenant_template.sql?raw';
import tenantLockdownSql from '../../supabase/tenant_lockdown.sql?raw';

const SITE_URL = 'https://sub-project.fin-route.site';
const MASTER_REF = 'ubhwoicsjmxslggltvaa';
const PROGRESS_KEY = 'finroute-admin-setup-guide-progress';

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function CopyButton({ text, label = 'Copy' }) {
  const [state, setState] = useState('idle');
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(text);
        setState(ok ? 'copied' : 'failed');
        setTimeout(() => setState('idle'), 1800);
      }}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer shrink-0 ${
        state === 'copied'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
          : state === 'failed'
            ? 'bg-red-50 text-red-700 border-red-300'
            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
      }`}
    >
      {state === 'copied' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      <span>{state === 'copied' ? 'Copied!' : state === 'failed' ? 'Select & copy manually' : label}</span>
    </button>
  );
}

function CodeBlock({ code, title, language = '', collapsible = false, hint }) {
  const [open, setOpen] = useState(!collapsible);
  const lines = code.split('\n').length;
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-900">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2 min-w-0">
          {collapsible && (
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              className="text-slate-300 hover:text-white cursor-pointer"
              aria-label={open ? 'Hide code' : 'Show code'}
            >
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
          <span className="text-[11px] font-bold text-slate-200 truncate">{title}</span>
          {language && <span className="text-[10px] font-mono text-slate-400 uppercase">{language}</span>}
          {collapsible && <span className="text-[10px] text-slate-400">{lines} lines</span>}
        </div>
        <CopyButton text={code} label={collapsible ? 'Copy whole script' : 'Copy'} />
      </div>
      {open ? (
        <pre className="p-3 text-[11.5px] leading-relaxed text-slate-100 font-mono overflow-x-auto max-h-80 whitespace-pre">{code}</pre>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full text-left px-3 py-2 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
        >
          Click to preview the script (you don't need to read it, just copy and run it).
        </button>
      )}
      {hint && <div className="px-3 py-2 text-[11px] text-slate-300 bg-slate-800/70 border-t border-slate-700">{hint}</div>}
    </div>
  );
}

function Callout({ type = 'info', children }) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warn: 'bg-amber-50 border-amber-200 text-amber-900',
    danger: 'bg-red-50 border-red-200 text-red-900',
    ok: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  };
  const Icon = type === 'warn' || type === 'danger' ? AlertTriangle : type === 'ok' ? CheckCircle2 : Info;
  return (
    <div className={`flex gap-2 p-3 rounded-xl border text-[12px] leading-relaxed ${styles[type]}`}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Click({ children }) {
  return <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-semibold text-slate-800 whitespace-nowrap">{children}</span>;
}

function LinkOut({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-700 font-semibold hover:underline">
      {children}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}

function Step({ number, title, time, done, onToggle, children }) {
  return (
    <section className={`rounded-2xl border bg-white shadow-xs ${done ? 'border-emerald-300' : 'border-slate-200'}`}>
      <header className="flex items-start justify-between gap-3 p-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold shrink-0 ${
            done ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
          }`}>
            {done ? <Check className="w-4 h-4" /> : number}
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
            {time && <p className="text-[11px] text-slate-500">About {time}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer shrink-0 ${
            done ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
          <span>{done ? 'Done' : 'Mark as done'}</span>
        </button>
      </header>
      <div className="p-4 space-y-3 text-[12.5px] text-slate-700 leading-relaxed">{children}</div>
    </section>
  );
}

function Section({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left cursor-pointer"
      >
        <span className="text-sm font-extrabold text-slate-900">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3 text-[12.5px] text-slate-700 leading-relaxed">{children}</div>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
const CHECK_POLICIES_SQL = `-- Expect only "Operators full access <table>" rows, all for {authenticated}
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- Expect NO rows (the public key has no table access)
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'anon';`;

const CHECK_USERS_SQL = `-- Expect one row for the operator, with role = operator
SELECT email, created_at, last_sign_in_at,
       raw_app_meta_data ->> 'finroute_role' AS role
FROM auth.users
ORDER BY created_at;`;

const MASTER_MIGRATIONS = [
  'supabase/supabase_master_setup.sql',
  'supabase/master_db_health_setup.sql',
  'supabase/migrations/20261026_super_admin_auth_migration.sql',
  'supabase/migrations/20261123_security_hardening.sql',
  'supabase/migrations/20261124_tenant_auth.sql',
  'supabase/migrations/20261125_tenant_delete.sql',
];

const DEPLOY_FUNCTIONS_CMD = `npx supabase functions deploy tenant-login admin-tenants keep-alive super-admin-login --project-ref ${MASTER_REF}`;
const ALLOWED_ORIGINS_CMD = `npx supabase secrets set --project-ref ${MASTER_REF} "ALLOWED_ORIGINS=${SITE_URL},http://localhost:5173,https://*--sub-project001.netlify.app"`;

function parseProjectRef(url) {
  const m = String(url || '').trim().match(/^https:\/\/([a-z0-9]{10,40})\.supabase\.co\/?$/i);
  return m ? m[1].toLowerCase() : '';
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function TenantSetupGuide({ onOpenAddTenant }) {
  const [projectUrl, setProjectUrl] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [done, setDone] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') || {};
    } catch {
      return {};
    }
  });

  const toggle = (id) => {
    setDone(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const resetProgress = () => {
    setDone({});
    try { localStorage.removeItem(PROGRESS_KEY); } catch { /* ignore */ }
  };

  const ref = parseProjectRef(projectUrl);
  const urlInvalid = projectUrl.trim() !== '' && !ref;
  const keyLooksSecret = publishableKey.trim().startsWith('sb_secret_');
  const dash = (path) => (ref ? `https://supabase.com/dashboard/project/${ref}/${path}` : 'https://supabase.com/dashboard/projects');
  const projectBase = ref ? `https://${ref}.supabase.co` : 'https://YOUR-PROJECT-REF.supabase.co';
  const keyForCmd = publishableKey.trim() && !keyLooksSecret ? publishableKey.trim() : 'YOUR_PUBLISHABLE_KEY';

  const verifyPowerShell = `curl.exe -s "${projectBase}/rest/v1/customers?select=id&limit=1" -H "apikey: ${keyForCmd}"`;
  const verifyBash = `curl -s "${projectBase}/rest/v1/customers?select=id&limit=1" -H "apikey: ${keyForCmd}"`;

  const steps = ['create', 'tables', 'lock', 'signups', 'keys', 'register', 'login', 'verify'];
  const completed = steps.filter(s => done[s]).length;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Intro */}
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Set up a new tenant database</h2>
            <p className="text-[12.5px] text-slate-600 leading-relaxed">
              Every tenant (business) gets its own private Supabase project. Follow these 8 steps in order; it takes about
              15 minutes. Copy buttons put the exact text on your clipboard, so you never have to type SQL by hand.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(completed / steps.length) * 100}%` }} />
          </div>
          <span className="text-[11px] font-bold text-slate-600">{completed} / {steps.length} done</span>
          {completed > 0 && (
            <button type="button" onClick={resetProgress} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer">
              <RotateCcw className="w-3 h-3" /> Start over
            </button>
          )}
        </div>
      </div>

      {/* Helper inputs */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Fill these in as you go (optional)</h3>
          <p className="text-[11.5px] text-slate-500">
            They make the links and commands below point at this tenant. Nothing here is saved or sent anywhere.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <label className="block">
            <span className="block font-semibold text-slate-700 mb-1">Tenant Project URL (from step 5)</span>
            <input
              value={projectUrl}
              onChange={(e) => setProjectUrl(e.target.value)}
              placeholder="https://abcdefghijklmnop.supabase.co"
              className={`w-full px-3 py-2 rounded-lg border font-mono focus:outline-none ${urlInvalid ? 'border-red-400 bg-red-50/40' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {urlInvalid && <span className="text-[11px] text-red-600">Should look like https://xxxxxxxx.supabase.co</span>}
          </label>
          <label className="block">
            <span className="block font-semibold text-slate-700 mb-1">Tenant Publishable key (from step 5)</span>
            <input
              value={publishableKey}
              onChange={(e) => setPublishableKey(e.target.value)}
              placeholder="sb_publishable_..."
              autoComplete="off"
              className={`w-full px-3 py-2 rounded-lg border font-mono focus:outline-none ${keyLooksSecret ? 'border-red-400 bg-red-50/40' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {keyLooksSecret && (
              <span className="text-[11px] text-red-600">That's the SECRET key. Use the publishable key here; the secret key only goes in the Add Tenant form.</span>
            )}
          </label>
        </div>
      </div>

      {/* Steps */}
      <Step number={1} title="Create the tenant's Supabase project" time="3 minutes" done={!!done.create} onToggle={() => toggle('create')}>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>Open <LinkOut href="https://supabase.com/dashboard/projects">Supabase dashboard</LinkOut> and click <Click>New project</Click>.</li>
          <li><b>Name:</b> something clear, e.g. <code className="font-mono">finroute-sunday-kovuru</code>.</li>
          <li><b>Database password:</b> click <Click>Generate a password</Click> and save it in a password manager. You won't need it for daily use.</li>
          <li><b>Region:</b> choose <b>South Asia (Mumbai)</b> for the fastest app.</li>
          <li>Click <Click>Create new project</Click> and wait about 2 minutes until it says the project is ready.</li>
        </ol>
        <Callout type="info">
          Free projects pause after about 7 days without activity. FinRoute's keep-alive job pings registered tenants every
          3 days, so they stay awake once you finish step 6.
        </Callout>
      </Step>

      <Step number={2} title="Create the ledger tables" time="1 minute" done={!!done.tables} onToggle={() => toggle('tables')}>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>
            In the new project, open <Click>SQL Editor</Click>
            {ref && <> (<LinkOut href={dash('sql/new')}>open it directly</LinkOut>)</>} and click <Click>New query</Click>.
          </li>
          <li>Click <b>Copy whole script</b> below, paste it into the editor, and click <Click>Run</Click>.</li>
          <li>You should see <b>"Success. No rows returned"</b>.</li>
        </ol>
        <CodeBlock code={tenantTemplateSql} title="Tenant tables (supabase_tenant_template.sql)" language="sql" collapsible />
        <Callout type="warn">
          Double-check the browser address bar shows the <b>tenant's</b> project before you click Run, not the FinRoute
          master project ({MASTER_REF}).
        </Callout>
      </Step>

      <Step number={3} title="Lock the database (only signed-in operators get in)" time="1 minute" done={!!done.lock} onToggle={() => toggle('lock')}>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>In the same SQL Editor, click <Click>New query</Click>.</li>
          <li>Copy the lockdown script below, paste it and click <Click>Run</Click>.</li>
          <li>Then run the check below and compare with the comments in it.</li>
        </ol>
        <CodeBlock code={tenantLockdownSql} title="Lockdown (tenant_lockdown.sql)" language="sql" collapsible />
        <CodeBlock code={CHECK_POLICIES_SQL} title="Check the lockdown worked" language="sql" />
        <Callout type="ok">
          Good result: every policy is called <b>Operators full access …</b> for <b>{'{authenticated}'}</b>, and the
          second query returns <b>no rows</b>.
        </Callout>
      </Step>

      <Step number={4} title="Turn off public sign-ups" time="30 seconds" done={!!done.signups} onToggle={() => toggle('signups')}>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>
            Go to <Click>Authentication</Click> → <Click>Sign In / Providers</Click>
            {ref && <> (<LinkOut href={dash('auth/providers')}>open it directly</LinkOut>)</>}.
          </li>
          <li>Turn <b>off</b> <Click>Allow new users to sign up</Click> and click <Click>Save</Click>.</li>
        </ol>
        <Callout type="info">FinRoute creates the operator's account itself, so nobody else ever needs to sign up here.</Callout>
      </Step>

      <Step number={5} title="Collect the 3 values FinRoute needs" time="2 minutes" done={!!done.keys} onToggle={() => toggle('keys')}>
        <p>
          Go to <Click>Project Settings</Click> → <Click>API Keys</Click>
          {ref && <> (<LinkOut href={dash('settings/api-keys')}>open it directly</LinkOut>)</>}.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-2 font-bold">Value</th>
                <th className="text-left p-2 font-bold">Looks like</th>
                <th className="text-left p-2 font-bold">Where to find it</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="p-2 font-semibold">Project URL</td>
                <td className="p-2 font-mono">https://xxxx.supabase.co</td>
                <td className="p-2">Project Settings → <b>Data API</b> (or the <b>Connect</b> button at the top)</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold">Publishable key</td>
                <td className="p-2 font-mono">sb_publishable_…</td>
                <td className="p-2">API Keys → <b>Publishable key</b> → copy</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold">Secret key</td>
                <td className="p-2 font-mono">sb_secret_…</td>
                <td className="p-2">API Keys → <b>Secret keys</b> → <Click>New secret key</Click> → name it <code className="font-mono">finroute-server</code> → copy</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Callout type="danger">
          <p><b>The secret key is like a master password for this tenant's data.</b></p>
          <p>Paste it only into the FinRoute <b>Add Tenant</b> / <b>Edit Tenant</b> form. Never send it on WhatsApp, email or chat, and never put it in code.</p>
        </Callout>
      </Step>

      <Step number={6} title="Register the tenant in FinRoute" time="2 minutes" done={!!done.register} onToggle={() => toggle('register')}>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>
            Open <Click>Tenants Directory</Click> → <Click>+ Add Tenant</Click>
            {onOpenAddTenant && (
              <> (<button type="button" onClick={onOpenAddTenant} className="text-blue-700 font-semibold hover:underline cursor-pointer">open the form now</button>)</>
            )}.
          </li>
          <li>Fill in the operator's name, email and a starting password, plus the <b>Project URL</b>, <b>Publishable key</b> and <b>Secret key</b> from step 5. Save.</li>
          <li>Open <Click>Edit</Click> on the new tenant, tick <Click>Require tenant sign-in</Click> and save.</li>
          <li>Share the email and starting password with the operator in person or by phone.</li>
        </ol>
        <Callout type="info">If you see a note like "sign-in account will be created on the operator's next login", that's normal.</Callout>
      </Step>

      <Step number={7} title="Operator logs in for the first time" time="2 minutes" done={!!done.login} onToggle={() => toggle('login')}>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>The operator opens <LinkOut href={`${SITE_URL}/#login`}>{SITE_URL}/#login</LinkOut> and signs in.</li>
          <li>They should see an empty ledger and be able to add a village, a customer and a payment.</li>
          <li>
            Check the account was created: tenant project → <Click>Authentication</Click> → <Click>Users</Click>
            {ref && <> (<LinkOut href={dash('auth/users')}>open it directly</LinkOut>)</>}, or run this in the tenant's SQL Editor:
          </li>
        </ol>
        <CodeBlock code={CHECK_USERS_SQL} title="Check the operator account" language="sql" />
      </Step>

      <Step number={8} title="Final check: the public key alone gets nothing" time="1 minute" done={!!done.verify} onToggle={() => toggle('verify')}>
        <p>
          Run one of these on your computer{!ref || keyForCmd === 'YOUR_PUBLISHABLE_KEY' ? ' (fill in the boxes at the top first, or replace the capital-letter parts)' : ''}.
        </p>
        <CodeBlock code={verifyPowerShell} title="Windows PowerShell" language="powershell" />
        <CodeBlock code={verifyBash} title="Git Bash / Mac / Linux" language="bash" />
        <div className="grid sm:grid-cols-2 gap-3">
          <Callout type="ok">
            <p><b>Locked (good):</b> the reply contains <code className="font-mono">42501</code> / <code className="font-mono">permission denied</code>.</p>
          </Callout>
          <Callout type="danger">
            <p><b>Still open (bad):</b> the reply shows <code className="font-mono">[ ]</code> or customer rows. Go back to step 3 and make sure you ran it in the tenant's project.</p>
          </Callout>
        </div>
        <p>Finally, open <Click>Keep-Alive & Health Logs</Click> → <Click>Ping & Wake All DBs</Click>. The new tenant should show <b>online</b>.</p>
      </Step>

      {/* Extra sections */}
      <Section title="Switching an existing (older) tenant to secure sign-in">
        <p>Older tenants were created before the lockdown. For each one, in this order:</p>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>Create a <b>secret key</b> in their project (step 5) and paste it into <Click>Edit</Click> → <b>Tenant Secret Key</b> → Save.</li>
          <li>Ask the operator to <b>log in once</b>; confirm their account appears in Authentication → Users (step 7).</li>
          <li><b>Turn off sign-ups</b> (step 4).</li>
          <li>Run the <b>lockdown script</b> in their SQL Editor (step 3).</li>
          <li>Edit the tenant → tick <b>Require tenant sign-in</b> → Save.</li>
          <li>Do the <b>final check</b> (step 8).</li>
        </ol>
        <Callout type="warn">
          Do it in exactly this order. If you lock the database before the operator has logged in once with a secret key
          saved, they can't reach their ledger until you finish the steps.
        </Callout>
      </Section>

      <Section title="Something went wrong? Quick fixes">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-2 font-bold">What you see</th>
                <th className="text-left p-2 font-bold">What to do</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="p-2">Operator sees "Please sign in again" right after logging in</td><td className="p-2">The secret key is wrong or missing. Re-paste it in Edit Tenant, then log in again.</td></tr>
              <tr><td className="p-2">Operator not listed in Authentication → Users</td><td className="p-2">Check the secret key belongs to <b>this</b> project. Master project → Edge Functions → <b>tenant-login</b> → Logs shows the reason.</td></tr>
              <tr><td className="p-2">Step 8 still shows rows</td><td className="p-2">The lockdown ran in a different project. Open the tenant's SQL Editor (check the URL) and run step 3 again.</td></tr>
              <tr><td className="p-2">"Save the tenant secret key before requiring tenant sign-in"</td><td className="p-2">Paste the secret key in the same Edit form, then tick the box.</td></tr>
              <tr><td className="p-2">Tenant shows "sleeping" in health logs</td><td className="p-2">Open the tenant project in Supabase and click <b>Restore project</b>, then ping again.</td></tr>
              <tr><td className="p-2">Operator forgot their password</td><td className="p-2">Edit Tenant → type a new password → Save. It updates both FinRoute and their tenant account.</td></tr>
            </tbody>
          </table>
        </div>
        <Callout type="info">
          Need to undo the lockdown in an emergency? The bottom of the lockdown script (step 3) has a ROLLBACK block. Also untick
          "Require tenant sign-in".
        </Callout>
      </Section>

      <Section title="Removing a tenant">
        <ul className="list-disc pl-5 space-y-1.5">
          <li><b>Pause access</b> (reversible): use the <b>Suspend</b> button in Tenants Directory.</li>
          <li><b>Delete</b> (permanent): use the <b>trash</b> button and type the tenant's email to confirm. This removes them from FinRoute and removes their sign-in account.</li>
          <li>
            Their own Supabase project and ledger data are <b>not</b> deleted. Export what you need (Table Editor → each table →
            Export as CSV), then delete the project in Supabase: Project Settings → General → <b>Delete project</b>.
          </li>
        </ul>
      </Section>

      <Section title="One-time platform setup (already done; for reference)">
        <p>Run once in the <b>master</b> project's SQL Editor (<LinkOut href={`https://supabase.com/dashboard/project/${MASTER_REF}/sql/new`}>open</LinkOut>), in this order:</p>
        <ol className="list-decimal pl-5 space-y-1 font-mono text-[11.5px]">
          {MASTER_MIGRATIONS.map(m => <li key={m}>{m}</li>)}
        </ol>
        <p>Allowed websites for the server functions (run in PowerShell from the project folder):</p>
        <CodeBlock code={ALLOWED_ORIGINS_CMD} title="Set ALLOWED_ORIGINS" language="powershell" />
        <p>Deploy the server functions after any change to them:</p>
        <CodeBlock code={DEPLOY_FUNCTIONS_CMD} title="Deploy Edge Functions" language="powershell" />
        <Callout type="info">
          If the deploy says "Access token not provided", run <code className="font-mono">npx supabase login</code> first.
        </Callout>
        <div className="flex items-center gap-2 text-[11.5px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Full checklist: docs/SECURITY_VERIFICATION_GUIDE.md and supabase/TENANT_AUTH_ROLLOUT.md in the code repository.</span>
        </div>
      </Section>
    </div>
  );
}
