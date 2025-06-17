"use client";
import Link from "next/link";
import { useAuth } from "@/context/AuthContex";
import { handleLogout } from "@/api/handlers";
import { useState } from "react";

export default function Navbar() {
  const { user, isAdmin, userData } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogoutClick = async () => {
      await handleLogout();
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav className="bg-white shadow-lg border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl">🏗️</span>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              SteelVision
            </span>
      </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              href="/projects" 
              className="text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium"
            >
          Projeler
        </Link>
            
            {isAdmin && (
              <>
                <Link 
                  href="/create-project" 
                  className="text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium"
                >
          Proje Ekle
        </Link>
          <Link
            href="/projects-admin-page"
                  className="text-red-600 hover:text-red-700 transition-colors duration-200 font-semibold"
          >
            Admin Projeler
          </Link>
              </>
        )}

        {!user ? (
              <div className="flex items-center space-x-4">
                <Link 
                  href="/login" 
                  className="text-blue-600 hover:text-blue-700 transition-colors duration-200 font-medium"
                >
              Giriş Yap
            </Link>
                <Link 
                  href="/register" 
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
                >
              Kayıt Ol
            </Link>
              </div>
        ) : (
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-medium">
                      {userData?.firstName?.[0]}{userData?.lastName?.[0]}
                    </span>
                  </div>
                  <span className="text-gray-700 font-medium">
                    {userData?.firstName} {userData?.lastName}
                  </span>
                </div>
                <button
                  onClick={handleLogoutClick}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors duration-200 font-medium"
                >
                  Çıkış Yap
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none transition-colors duration-200"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {isMobileMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 space-y-4 border-t border-gray-100">
            <Link
              href="/projects"
              className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200"
            >
              Projeler
            </Link>
            
            {isAdmin && (
              <>
                <Link
                  href="/create-project"
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200"
                >
                  Proje Ekle
                </Link>
                <Link
                  href="/projects-admin-page"
                  className="block px-4 py-2 text-red-600 hover:bg-gray-50 rounded-lg transition-colors duration-200 font-semibold"
                >
                  Admin Projeler
                </Link>
              </>
            )}

            {!user ? (
              <div className="px-4 space-y-2">
                <Link
                  href="/login"
                  className="block w-full text-center text-blue-600 hover:bg-gray-50 py-2 rounded-lg transition-colors duration-200"
                >
                  Giriş Yap
                </Link>
                <Link
                  href="/register"
                  className="block w-full text-center bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Kayıt Ol
                </Link>
              </div>
            ) : (
              <div className="px-4 space-y-4">
                <div className="flex items-center space-x-3 p-2">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-medium">
                      {userData?.firstName?.[0]}{userData?.lastName?.[0]}
                    </span>
                  </div>
                  <span className="text-gray-700 font-medium">
                    {userData?.firstName} {userData?.lastName}
                  </span>
                </div>
            <button
              onClick={handleLogoutClick}
                  className="w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors duration-200"
            >
              Çıkış Yap
            </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
