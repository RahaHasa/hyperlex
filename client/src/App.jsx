import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import Search from './pages/Search';
import Compare from './pages/Compare';
import Login from './pages/Login';
import Register from './pages/Register';
import Admin from './pages/Admin';
import AdminWords from './pages/AdminWords';
import Profile from './pages/Profile';

function App() {
  return (
    <Router>
      <div className="app">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/words" element={<AdminWords />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
