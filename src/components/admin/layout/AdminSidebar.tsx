import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton,
  SidebarMenuSubItem, useSidebar,
} from '@/components/ui/sidebar';
import { ADMIN_NAV, findActive } from './adminNav';
import { useCity } from '@/hooks/useCity';
import { MapPin } from 'lucide-react';

interface Props {
  inboxBadge?: number;
}

/** Tree navigation: hubs expand to reveal leaf tabs. Active branch stays open. */
export function AdminSidebar({ inboxBadge = 0 }: Props) {
  const { currentCity } = useCity();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const { pathname } = useLocation();
  const active = findActive(pathname);
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-3 py-3 flex items-center gap-2 border-b">
          <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold text-sm leading-tight truncate">{currentCity.name}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">
                {currentCity.name_mr ? `${currentCity.name_mr} · ` : ''}Admin
              </div>
            </div>
          )}
        </div>

        {ADMIN_NAV.map((hub) => {
          const HubIcon = hub.icon;
          const isHubActive = active?.hub.key === hub.key;
          const hasLeaves = hub.leaves.length > 0;

          return (
            <SidebarGroup key={hub.key}>
              {!collapsed && (
                <SidebarGroupLabel className="text-[10px] uppercase tracking-wider">
                  {hub.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {!hasLeaves && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isHubActive} tooltip={hub.label}>
                        <NavLink to={hub.path} onClick={closeOnMobile}>
                          <HubIcon className="w-4 h-4 shrink-0" />
                          {!collapsed && <span className="truncate">{hub.label}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {hasLeaves && hub.leaves.map((leaf) => {
                    const LeafIcon = leaf.icon;
                    const isActive = active?.leaf?.key === leaf.key;
                    const badge = leaf.badgeKey === 'inbox' ? inboxBadge : 0;
                    return (
                      <SidebarMenuItem key={leaf.key}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={leaf.label}>
                          <NavLink to={leaf.path} onClick={closeOnMobile}>
                            <LeafIcon className="w-4 h-4 shrink-0" />
                            {!collapsed && (
                              <span className="flex items-center justify-between flex-1 min-w-0">
                                <span className="truncate">{leaf.label}</span>
                                {leaf.status === 'soon' && (
                                  <span className="ml-2 shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                                    Soon
                                  </span>
                                )}
                                {badge > 0 && (
                                  <span className="ml-2 shrink-0 min-w-[18px] h-[18px] text-[10px] font-bold rounded-full px-1 flex items-center justify-center bg-secondary text-secondary-foreground">
                                    {badge}
                                  </span>
                                )}
                              </span>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
