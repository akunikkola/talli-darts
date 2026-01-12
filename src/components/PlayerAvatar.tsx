"use client";

import Image from "next/image";

interface PlayerAvatarProps {
  name: string;
  profilePictureUrl: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8 text-sm",
  md: "w-12 h-12 text-lg",
  lg: "w-16 h-16 text-2xl",
};

export default function PlayerAvatar({
  name,
  profilePictureUrl,
  size = "md",
  className = "",
}: PlayerAvatarProps) {
  const sizeClass = sizeClasses[size];

  if (profilePictureUrl) {
    return (
      <div className={`relative ${sizeClass} rounded-lg overflow-hidden ${className}`}>
        <Image
          src={profilePictureUrl}
          alt={name}
          fill
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-lg bg-[#4ade80] flex items-center justify-center font-bold text-black ${className}`}
    >
      {name.charAt(0)}
    </div>
  );
}
