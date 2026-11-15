"use client";

// GCC - desktop user dropdown.
//
// The avatar opens a menu with the viewer's profile, matches, notifications and
// the workspace they can actually use. Sign out lives here too. The list is
// built from the same role-filtered config as the mobile sheet.
import { ChevronDown, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar } from "@/components/ui/data-display";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { viewerName, type Viewer } from "@/lib/auth/viewer";
import { viewerNavigation, type NavigationViewer } from "@/lib/config/navigation";

export function DesktopUserMenu({ viewer }: { readonly viewer: Viewer }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const navigation = viewerNavigation({
    role: viewer.role,
    isSuperAdmin: viewer.isSuperAdmin,
  } satisfies NavigationViewer);
  const name = viewerName(viewer);

  async function signOut(): Promise<void> {
    if (signingOut) {
      return;
    }

    setSigningOut(true);

    try {
      // The Firebase client SDK is a large download that this menu does not
      // need until someone actually signs out. Importing it inside the handler
      // keeps it out of every public page's first load.
      const { signOutCompletely } = await import("@/lib/auth/client");
      await signOutCompletely();
      router.refresh();
      router.push("/");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu
      label="Account menu"
      align="end"
      trigger={
        <span className="flex items-center gap-2">
          <Avatar name={name} src={viewer.avatarUrl ?? null} size="sm" />
          <span className="hidden max-w-32 truncate text-sm font-semibold text-white xl:block">
            {name}
          </span>
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-grey-400" />
        </span>
      }
      items={[
        ...navigation.desktopUser.map((item) => ({
          label: item.label,
          href: item.href,
          icon: <item.icon aria-hidden="true" className="h-4 w-4" />,
        })),
        {
          label: "Sign out",
          icon: <LogOut aria-hidden="true" className="h-4 w-4" />,
          danger: true,
          separatorBefore: true,
          disabled: signingOut,
          onSelect: () => {
            void signOut();
          },
        },
      ]}
    />
  );
}
