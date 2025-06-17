import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Hakkında */}
          <div>
            <h3 className="text-lg font-semibold mb-4">SteelVision</h3>
            <p className="text-gray-400 text-sm">
              Üretim süreçlerinizi dijitalleştirin, takip edin ve optimize edin.
              SteelVision ile üretim süreçlerinizi daha verimli hale getirin.
            </p>
          </div>

          {/* Hızlı Linkler */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Hızlı Linkler</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/projects" className="text-gray-400 hover:text-white text-sm">
                  Projeler
                </Link>
              </li>
              <li>
                <Link href="/projects-admin-page" className="text-gray-400 hover:text-white text-sm">
                  Proje Yönetimi
                </Link>
              </li>
              <li>
                <Link href="/profile" className="text-gray-400 hover:text-white text-sm">
                  Profil
                </Link>
              </li>
            </ul>
          </div>

          {/* İletişim */}
          <div>
            <h3 className="text-lg font-semibold mb-4">İletişim</h3>
            <ul className="space-y-2">
              <li className="text-gray-400 text-sm">
                Email: info@Steelvision.com
              </li>
              <li className="text-gray-400 text-sm">
                Tel: +90 (555) 123 45 67
              </li>
              <li className="text-gray-400 text-sm">
                Adres: Balıkesir, Bandırma
              </li>
            </ul>
          </div>
        </div>

        {/* Alt Bilgi */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} SteelVision. Tüm hakları saklıdır.
            </p>
            <div className="mt-4 md:mt-0">
              <p className="text-gray-400 text-sm">
                Designed by{' '}
                <a
                  href="https://linkedin.com/in/ahmet-salih-cozel/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                >
                  Ahmet Salih Çözel
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
} 