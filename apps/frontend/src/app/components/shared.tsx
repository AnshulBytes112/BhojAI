'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { canRoleAccessPath, getRoleHomePath, normalizeRole, type AppRole } from '../lib/roles';

export function IconFlame({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.047 8.287 8.287 0 009 9.601a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
    </svg>
  );
}

export function IconGrid({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

export function IconClipboard({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  );
}

export function IconChef({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5M15 21v-10.5m-3 10.5V10.5m-3 10.5v-4.5m0 0h9m-9 0H6" />
    </svg>
  );
}

export function IconChart({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

export function IconMenu({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

export function IconCog({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export function IconUser({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

export function IconSearch({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
    </svg>
  );
}

export function IconBell({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

export function IconCheck({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

export function IconX({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function IconPlus({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

export function IconMinus({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
    </svg>
  );
}

export function IconArrowUp({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
    </svg>
  );
}

export function IconArrowDown({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
    </svg>
  );
}

export function IconPrint({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
    </svg>
  );
}

export function IconEdit({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.25 2.25 0 113.182 3.182L9 17.713l-4.5.75.75-4.5L16.862 3.487z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.75l3 3" />
    </svg>
  );
}

export function IconTrash({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0115.916 21.75H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0V4.875A2.25 2.25 0 0013.5 2.625h-3A2.25 2.25 0 008.25 4.875v.518m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

export function IconWifi({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
    </svg>
  );
}

export function IconWifiOff({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.584 10.587a3.75 3.75 0 015.29 5.29m-6.4-5.29L5.106 11.856a7.452 7.452 0 00-.082.082M5.106 11.856a11.25 11.25 0 0113.788 0M1.924 8.674a15.75 15.75 0 0120.152 0M6.75 15.75a5.25 5.25 0 017.5 0M12 18.75l.53.53.53-.53a.75.75 0 00-1.06 0z" />
    </svg>
  );
}

export function IconCash({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );
}

export function IconCard({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  );
}

export function IconQR({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
    </svg>
  );
}

export function IconLogout({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  );
}

export function IconClock({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function IconUsers({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

export function IconStar({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
    </svg>
  );
}

export function IconTag({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </svg>
  );
}

export function IconInventory({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

export function IconKitchen({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
    </svg>
  );
}

const navItems: Array<{
  href: string;
  icon: ({ className }: { className?: string }) => React.JSX.Element;
  label: string;
  badge: number;
  roles: AppRole[];
}> = [
    { href: '/analytics', icon: IconChart, label: 'Dashboard', badge: 0, roles: ['ADMIN', 'MANAGER', 'WAITER'] },
    { href: '/pos/order', icon: IconClipboard, label: 'POS', badge: 0, roles: ['ADMIN', 'MANAGER', 'WAITER'] },
    { href: '/kds', icon: IconKitchen, label: 'Kitchen', badge: 0, roles: ['ADMIN', 'MANAGER', 'CHEF', 'WAITER'] },
    { href: '/pos/tables', icon: IconGrid, label: 'Table', badge: 0, roles: ['ADMIN', 'MANAGER', 'WAITER'] },
    { href: '/pos/reservations', icon: IconClock, label: 'Reservations', badge: 1, roles: ['ADMIN', 'MANAGER', 'WAITER'] },
    { href: '/menu', icon: IconMenu, label: 'Offering', badge: 0, roles: ['ADMIN', 'MANAGER', 'WAITER'] },
    { href: '/inventory', icon: IconInventory, label: 'Inventory', badge: 0, roles: ['ADMIN', 'MANAGER', 'WAITER'] },
    { href: '/pos/bills', icon: IconCash, label: 'Payments', badge: 14, roles: ['ADMIN', 'MANAGER', 'WAITER'] },
    { href: '/invoice', icon: IconPrint, label: 'Invoice', badge: 0, roles: ['ADMIN', 'MANAGER', 'WAITER'] },
    { href: '/user', icon: IconUsers, label: 'User', badge: 0, roles: ['ADMIN', 'MANAGER', 'WAITER'] },
  ];

interface SidebarProps {
  activePath: string;
}

export function Sidebar({ activePath }: SidebarProps) {
  const router = useRouter();
  const [role, setRole] = useState<AppRole>('WAITER');
  const [userName, setUserName] = useState('Admin User');
  const [roleReady, setRoleReady] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    setRole(normalizeRole(user?.role));
    setUserName(user?.name || user?.username || 'Admin User');
    setRoleReady(true);
  }, [activePath]);

  useEffect(() => {
    if (!roleReady) return;
    if (!canRoleAccessPath(role, activePath)) {
      router.replace(getRoleHomePath(role));
    }
  }, [activePath, role, roleReady, router]);

  const visibleNavItems = navItems.filter((item) => item.roles.includes(role));
  const canOpenSettings = role === 'ADMIN' || role === 'MANAGER';

  const handleExit = () => {
    localStorage.removeItem('auth.token');
    localStorage.removeItem('auth.user');
    router.push('/login');
  };

  return (
    <aside style={{ width: 240, background: '#f5f4ef', display: 'flex', flexDirection: 'column', borderRight: '1px solid #eae7e0', flexShrink: 0, height: '100%', overflowY: 'auto' }}>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 24px 32px 24px' }}>
        <div style={{ width: 28, height: 28, background: '#ea580c', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <IconFlame className="w-4 h-4" />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.5px' }}>RestroBit</div>
      </div>

      {/* Profile Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', marginBottom: 32 }}>
        <img src={`https://i.pravatar.cc/100?u=${userName}`} alt="Profile" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', textTransform: 'capitalize' }}>{userName}</div>
          <div style={{ fontSize: 12, color: '#888', textTransform: 'capitalize' }}>{role.toLowerCase()}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 16px', flex: 1 }}>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePath.startsWith(item.href);

          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: isActive ? '#fef2e8' : 'transparent',
                color: isActive ? '#ea580c' : '#666',
                fontWeight: isActive ? 600 : 500,
                fontSize: 14, transition: 'all 0.15s',
                position: 'relative'
              }}
              onMouseEnter={e => !isActive && (e.currentTarget.style.color = '#1a1a1a')}
              onMouseLeave={e => !isActive && (e.currentTarget.style.color = '#666')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, color: isActive ? '#ea580c' : '#888' }}>
                <Icon />
              </div>
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span style={{ marginLeft: 'auto', background: isActive ? '#ea580c' : '#333', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                  {item.badge}
                </span>
              )}
              {/* Active Indicator Left Bar */}
              {isActive && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 4, height: 24, background: '#ea580c', borderRadius: '0 4px 4px 0' }} />}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '24px 16px', marginTop: 'auto' }}>
        <button
          onClick={handleExit}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#666', fontSize: 14, fontWeight: 500, transition: 'color 0.15s', width: '100%' }}
          onMouseEnter={e => e.currentTarget.style.color = '#ea580c'}
          onMouseLeave={e => e.currentTarget.style.color = '#666'}
        >
          <div style={{ transform: 'rotate(180deg)', display: 'flex' }}>
            <IconLogout />
          </div>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

interface TopBarProps {
  title: string;
  subtitle?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
}

const ROLE_BADGE_META: Record<AppRole, { label: string; border: string; color: string; background: string }> = {
  ADMIN: {
    label: 'Admin Workspace',
    border: 'rgba(185, 28, 28, 0.35)',
    color: '#7f1d1d',
    background: 'rgba(254, 226, 226, 0.86)',
  },
  MANAGER: {
    label: 'Manager Console',
    border: 'rgba(5, 150, 105, 0.35)',
    color: '#065f46',
    background: 'rgba(209, 250, 229, 0.88)',
  },
  WAITER: {
    label: 'Waiter Desk',
    border: 'rgba(37, 99, 235, 0.35)',
    color: '#1e3a8a',
    background: 'rgba(219, 234, 254, 0.88)',
  },
  CHEF: {
    label: 'Chef Station',
    border: 'rgba(217, 119, 6, 0.35)',
    color: '#92400e',
    background: 'rgba(254, 243, 199, 0.9)',
  },
};

export function TopBar({ title, subtitle, searchValue, onSearchChange, searchPlaceholder, actions }: TopBarProps) {
  const [userName, setUserName] = useState('Restaurant Team');
  const [userInitials, setUserInitials] = useState('RT');
  const [role, setRole] = useState<AppRole>('WAITER');
  const [online, setOnline] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const router = useRouter();
  const { logout } = useAuthStore();

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const roleBadge = ROLE_BADGE_META[role];

  useEffect(() => {
    const rawUser = localStorage.getItem('auth.user');

    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser) as { name?: string; username?: string; role?: string };
        const nextName = parsed.name || parsed.username || 'Restaurant Team';
        setRole(normalizeRole(parsed.role));
        setUserName(nextName);
        setUserInitials(
          nextName
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() || '')
            .join('') || 'RT'
        );
      } catch {
        setRole('WAITER');
        setUserName('Restaurant Team');
        setUserInitials('RT');
      }
    } else {
      setRole('WAITER');
    }

    const syncStatus = () => setOnline(window.navigator.onLine);
    syncStatus();
    window.addEventListener('online', syncStatus);
    window.addEventListener('offline', syncStatus);

    return () => {
      window.removeEventListener('online', syncStatus);
      window.removeEventListener('offline', syncStatus);
    };
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        {subtitle && <div className="topbar-subtitle">{subtitle}</div>}
      </div>

      <div className="topbar-spacer" />

      {onSearchChange && (
        <div className="topbar-search">
          <IconSearch />
          <input
            type="text"
            placeholder={searchPlaceholder || 'Search...'}
            value={searchValue || ''}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <span className="text-xs text-dim">Ctrl+K</span>
        </div>
      )}

      <div className="topbar-chip">
        <IconClock />
        <span>{timeStr}</span>
        <span className="text-dim">|</span>
        <span>{dateStr}</span>
      </div>

      <div className={`topbar-chip ${online ? '' : 'offline'}`}>
        {online ? <IconWifi /> : <IconWifiOff />}
        <span>{online ? 'Live Sync' : 'Offline Mode'}</span>
      </div>

      <div
        className="topbar-chip"
        style={{
          borderColor: roleBadge.border,
          background: roleBadge.background,
          color: roleBadge.color,
          fontWeight: 700,
        }}
      >
        <IconUser />
        <span>{roleBadge.label}</span>
      </div>

      {actions}

      <div
        className="topbar-avatar"
        title={userName}
        onClick={() => setShowProfileMenu(!showProfileMenu)}
        style={{ position: 'relative' }}
      >
        {userInitials}

        {showProfileMenu && (
          <div className="topbar-profile-menu">
            <div className="topbar-profile-header">
              <div className="topbar-profile-name">{userName}</div>
              <div className="topbar-profile-role">{role}</div>
            </div>
            <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid var(--outline-variant)' }} />
            <button
              className="topbar-profile-item"
              onClick={() => {
                router.push('/settings');
                setShowProfileMenu(false);
              }}
            >
              <IconCog />
              Settings
            </button>
            <button
              className="topbar-profile-item logout"
              onClick={() => {
                handleLogout();
                setShowProfileMenu(false);
              }}
            >
              <IconLogout />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export interface ToastItem {
  id: string;
  icon: string;
  title: string;
  message?: string;
  action?: string;
  onAction?: () => void;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          <span className="toast-icon">{toast.icon}</span>
          <div className="toast-content">
            <div className="toast-title">{toast.title}</div>
            {toast.message && <div className="toast-msg">{toast.message}</div>}
          </div>
          {toast.action && toast.onAction && (
            <button
              className="toast-action"
              onClick={() => {
                toast.onAction?.();
                onDismiss(toast.id);
              }}
            >
              {toast.action}
            </button>
          )}
          <button
            className="btn btn-ghost btn-icon"
            style={{ width: 24, height: 24, padding: 0 }}
            onClick={() => onDismiss(toast.id)}
          >
            <IconX />
          </button>
        </div>
      ))}
    </div>
  );
}
