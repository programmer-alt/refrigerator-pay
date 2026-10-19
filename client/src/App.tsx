import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { ShopPage } from './pages/ShopPage';
import { SuccessPage } from './pages/SuccessPage';
import { CancelPage } from './pages/CancelPage';
import { PaymentPage } from './pages/PaymentPage';
import { ReceiptPage } from './pages/ReceiptPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<ShopPage />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/receipt/:orderId" element={<ReceiptPage />} />
            <Route path="/success" element={<SuccessPage />} />
            <Route path="/cancel" element={<CancelPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
