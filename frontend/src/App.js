import './App.css';
import AdminStream from './AdminStream';
import ViewerStream from './ViewerStream';
import { Route, Routes } from 'react-router-dom'
function App() {
  return (
    <>
      <div className="App">
        <Routes>
          <Route path="/admin" element={<AdminStream />} />
          <Route path="/viewer" element={<ViewerStream />} />
        </Routes>
      </div>
    </>
  );
}

export default App;
