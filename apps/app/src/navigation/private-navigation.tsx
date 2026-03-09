import {
  Feature,
  RouteChangeNotifier,
  DeploymentManager,
  SessionManager,
  EnvironmentContext,
} from '@novx/portal';
import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { LocaleManager } from '@novx/i18n';
import { of } from 'rxjs';
import { Environment } from '@novx/core';

import { NavigationList } from './navigation-list';
import ModulesModal, { Module } from '../component/modules-dialog';
import LocaleSwitch from '../component/locale-switch'; 

// A small wrapper to make Outlet reactive to route changes
const ReactiveOutlet: React.FC = () => {
  const location = useLocation();
  return <Outlet key={location.pathname} />;
};

@Feature({
  id: 'private-navigation',
  label: 'Navigation',
  preloadI18n: ['portal'],
  visibility: ['private'],
  tags: ['portal'],
  path: '/',
})
export class Navigation extends React.Component<
  object,
  { sidebarCollapsed: boolean; currentPath: string; showModulesModal: boolean; hasSession: boolean }
> {
  private unsubscribe?: () => void;

  state = {
    sidebarCollapsed: false,
    currentPath: window.location.pathname,
    showModulesModal: false,
    hasSession: false,
  };

  static contextType = EnvironmentContext;
  declare context: Environment;

  componentDidMount() {
    const notifier = this.context.get(RouteChangeNotifier);
    this.unsubscribe = notifier.subscribe((location) => {
      console.log('[Navigation] Route changed to:', location.pathname);
      this.setState({ currentPath: location.pathname });
    });

    const localeManager = this.context.get(LocaleManager);
    localeManager.subscribe({
      onLocaleChange: () => {
        this.setState({});
        return of({});
      },
    });

    this.updateSessionState();
  }

  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe();
  }

  updateSessionState = () => {
    const sessionManager = this.context.get(SessionManager);
    this.setState({ hasSession: sessionManager.hasSession() });
  };

  toggleSidebar = () => this.setState({ sidebarCollapsed: !this.state.sidebarCollapsed });
  toggleModulesModal = () => this.setState({ showModulesModal: !this.state.showModulesModal });

  handleLoginLogout = async () => {
    const sessionManager = this.context.get(SessionManager);
    if (this.state.hasSession) {
      await sessionManager.closeSession();
    } else {
      await sessionManager.openSession({});
    }
    this.updateSessionState();
  };

  setLocale(locale: string) {
    const localeManager = this.context.get(LocaleManager);
    localeManager.setLocale(locale);
  }

  render() {
    const deploymentManager = this.context.get(DeploymentManager);
    const sessionManager = this.context.get(SessionManager);
    const { sidebarCollapsed, showModulesModal, hasSession } = this.state;

    const user = sessionManager.currentSession()?.user;
    const deployment = deploymentManager.deployment;

    const modules: Module[] = deployment
      ? Object.entries(deployment.modules).map(([name, manifest]) => ({
          name,
          label: manifest.label || name,
          version: manifest.version || 'N/A',
          loaded: manifest.loaded || false,
        }))
      : [];

    const localeManager = this.context.get(LocaleManager);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
        {/* HEADER */}
        <header
          style={{
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            background: '#1e1e2f',
            color: '#fff',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={this.toggleSidebar}
            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer' }}
          >
            ☰
          </button>

          <div style={{ fontWeight: 'bold', fontSize: '18px' }}>My App</div>

          {/* RIGHT CONTROLS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Modules Button */}
            <button
              onClick={this.toggleModulesModal}
              style={{
                padding: '8px 16px',
                backgroundColor: '#4a5568',
                color: '#fff',
                border: '1px solid #2d3748',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#5a6578')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#4a5568')}
            >
              <span>📦</span>
              <span>
                Modules ({modules.filter((m) => m.loaded).length}/{modules.length})
              </span>
            </button>

            {/* Login/Logout */}
            <button
              onClick={this.handleLoginLogout}
              style={{
                padding: '8px 16px',
                backgroundColor: hasSession ? '#d32f2f' : '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = hasSession ? '#f44336' : '#1565c0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = hasSession ? '#d32f2f' : '#1976d2';
              }}
            >
              {hasSession ? 'Logout' : 'Login'}
            </button>

            {/* User Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: hasSession ? '#4a5568' : '#666',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '16px',
                }}
              >
                {hasSession && user ? user.name?.charAt(0).toUpperCase() : '?'}
              </div>
              {hasSession && user && (
                <div style={{ fontSize: '12px', lineHeight: 1.2 }}>
                  <div style={{ fontWeight: '600' }}>{user.name}</div>
                  <div style={{ color: '#aaa', fontSize: '11px' }}>{user.email}</div>
                </div>
              )}
            </div>

            {/* Locale Switch */}
            <LocaleSwitch localeManager={localeManager} />
          </div>
        </header>

        {/* MODULES MODAL */}
        <ModulesModal isOpen={showModulesModal} modules={modules} onClose={this.toggleModulesModal} />

        {/* MAIN CONTENT */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <aside
            style={{
              width: sidebarCollapsed ? '60px' : '220px',
              background: '#2c2c3e',
              color: '#fff',
              transition: 'width 0.2s',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              overflowY: 'auto',
            }}
          >
            <NavigationList collapsed={sidebarCollapsed} />
          </aside>

          <main style={{ flex: 1, background: '#f4f4f4', overflowY: 'auto' }}>
            <ReactiveOutlet />
          </main>
        </div>
      </div>
    );
  }
}