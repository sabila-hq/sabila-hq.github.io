import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { AiChat } from './pages/AiChat';
import { Settings } from './pages/Settings';
import { Explorer } from './pages/Explorer';
import { Tools } from './pages/Tools';
import { AboutPage } from './pages/AboutPage';
import { SetupWizard } from './pages/SetupWizard';
// New feature pages
import { MailCatcherPage } from './pages/MailCatcherPage';
import { DatabasePage } from './pages/Database';
import { ApiTesterPage } from './pages/ApiTesterPage';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState('dark');
  const [language, setLanguage] = useState('id');
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if setup has been completed
    // @ts-ignore
    window.api.getSetupComplete().then((complete: boolean) => {
      setSetupComplete(complete);
    });

    // @ts-ignore
    window.api.getSettings().then((settings: any) => {
      const initialTheme = settings.theme || 'dark';
      setTheme(initialTheme);
      setLanguage(settings.language || 'id');
      
      if (initialTheme === 'light') {
        document.documentElement.classList.add('theme-light');
        document.documentElement.classList.remove('theme-dark');
      } else {
        document.documentElement.classList.remove('theme-light');
        document.documentElement.classList.add('theme-dark');
      }
      
      if (settings.language === 'ar') {
        document.documentElement.setAttribute('dir', 'rtl');
      } else {
        document.documentElement.removeAttribute('dir');
      }
    });

    const handleSwitchTab = (e: any) => {
      if (e.detail?.tab) setActiveTab(e.detail.tab);
    };
    window.addEventListener('switch-tab', handleSwitchTab);
    return () => window.removeEventListener('switch-tab', handleSwitchTab);
  }, []);

  // Loading state
  if (setupComplete === null) {
    return <div style={{ background: '#0f0f1a', width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner"></div>
    </div>;
  }

  // Show setup wizard if not completed
  if (!setupComplete) {
    return <SetupWizard onComplete={() => {
      setSetupComplete(true);
      // Reload settings after wizard
      // @ts-ignore
      window.api.getSettings().then((settings: any) => {
        setTheme(settings.theme || 'dark');
        setLanguage(settings.language || 'id');
        if (settings.theme === 'light') {
          document.documentElement.classList.add('theme-light');
          document.documentElement.classList.remove('theme-dark');
        } else {
          document.documentElement.classList.remove('theme-light');
          document.documentElement.classList.add('theme-dark');
        }
        
        if (settings.language === 'ar') {
          document.documentElement.setAttribute('dir', 'rtl');
        } else {
          document.documentElement.removeAttribute('dir');
        }
      });
    }} />;
  }

  return (
    <div className={`app-layout theme-${theme}`} style={{ paddingTop: '36px' }}>
      <TitleBar />
      {/* Abstract Background Blobs */}
      <div className="bg-blob-1"></div>
      <div className="bg-blob-2"></div>
      
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} lang={language} />
      
      <main className="main-content">
        <div className="content-wrapper">
          {activeTab === 'dashboard' && <Dashboard lang={language} />}
          {activeTab === 'projects' && <Projects lang={language} />}
          {activeTab === 'database' && <DatabasePage lang={language} />}
          {activeTab === 'api-tester' && <ApiTesterPage lang={language} />}
          {activeTab === 'ai-chat' && <AiChat lang={language} />}
          {activeTab === 'tools' && <Tools lang={language} />}
          {activeTab === 'about' && <AboutPage lang={language} />}
          {activeTab === 'settings' && <Settings lang={language} onSettingsChange={(s: any) => {
             setTheme(s.theme);
             setLanguage(s.language);
             if (s.theme === 'light') {
               document.documentElement.classList.add('theme-light');
               document.documentElement.classList.remove('theme-dark');
             } else {
               document.documentElement.classList.remove('theme-light');
               document.documentElement.classList.add('theme-dark');
             }
             if (s.language === 'ar') {
               document.documentElement.setAttribute('dir', 'rtl');
             } else {
               document.documentElement.removeAttribute('dir');
             }
           }} />}
        </div>
      </main>
    </div>
  );
}

export default App;
