"use client";

import { useAuth } from "./AuthProvider";
import { LogIn, LogOut, User } from "lucide-react";

export default function UserMenu() {
  const { user, profile, loading, signInWithGoogle, signOut } = useAuth();

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <button
        onClick={signInWithGoogle}
        className="flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-medium px-4 py-2 rounded-lg transition-all cursor-pointer text-sm"
      >
        <LogIn size={16} />
        Sign in
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden sm:flex flex-col items-end">
        <span className="text-sm font-medium text-gray-700">
          {profile?.display_name || user.email?.split("@")[0]}
        </span>
        <span className="text-xs text-emerald-600 font-semibold">
          ${(profile?.paper_balance ?? 10000).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      </div>
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt=""
          className="w-8 h-8 rounded-full border border-gray-200"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <User size={16} className="text-blue-600" />
        </div>
      )}
      <button
        onClick={signOut}
        className="p-2 rounded-lg border border-gray-200 hover:border-gray-300 text-gray-400 hover:text-gray-700 transition-all cursor-pointer"
        title="Sign out"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
