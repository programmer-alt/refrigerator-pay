import { Refrigerator } from 'lucide-react';
import './Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header__inner">
        <div className="header__logo">
          <Refrigerator size={28} />
          <span>FrigoShop</span>
        </div>
        <nav className="header__nav">
          <a href="/" className="header__link">
            Каталог
          </a>
          <a href="#" className="header__link">
            Доставка
          </a>
          <a href="#" className="header__link">
            Контакты
          </a>
        </nav>
      </div>
    </header>
  );
}
