import React from 'react';
import { Link, useLocation } from 'react-router-dom';

import { FeatureRegistry, SessionManager, useInject, Icon } from '@novx/portal';
import { LocaleManager } from '@novx/i18n';
import { of } from 'rxjs';

export interface NavigationListProps {
  collapsed?: boolean;
}

export const NavigationList: React.FC<NavigationListProps> = ({
  collapsed = false,
}) => {
  const location = useLocation();
  const [, forceRender] = React.useState(0);


  const [featureRegistry, sessionManager, localeManager] = useInject(FeatureRegistry, SessionManager, LocaleManager);


  /* ----------------------------------------------------
   * Re-render on locale change (labels update)
   * ---------------------------------------------------- */
  React.useEffect(() => {
    const unsubscribe = localeManager.subscribe(
      {
        onLocaleChange: () => {
          forceRender((x) => x + 1);
          return of({});
        },
      },
      10,
    );

    return unsubscribe;
  }, []);

  /* ----------------------------------------------------
   * Resolve features
   * ---------------------------------------------------- */
  const features = React.useMemo(() => {
    const features = featureRegistry
      .finder()
      .withPath()
      .withoutParent()
      .matchesSession(sessionManager.hasSession())
      .withTag('menu')
      .find();

      return features
  }, [location.pathname]);

  /* ----------------------------------------------------
   * Render
   * ---------------------------------------------------- */
  return (
    <>
      {features.map((feature : any) => {
        const featurePath = feature.path!.startsWith('/')
          ? feature.path!
          : `/${feature.path}`;

        const isActive =
          location.pathname === featurePath ||
          (location.pathname.startsWith(featurePath + '/') &&
            featurePath !== '/');

        return (
          <Link
            key={feature.id}
            to={featurePath}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              color: '#fff',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              background: isActive ? '#444' : 'transparent',
              transition: 'background 0.15s ease',
            }}
          >
            {/* Icon                  style={{ flexShrink: 0 }} */}
            {feature.icon && (
              <Icon
                name={feature.icon}
                size={20}

              />
            )}

            {/* Label */}
            {!collapsed && (
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {feature.label || feature.id}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );
};
