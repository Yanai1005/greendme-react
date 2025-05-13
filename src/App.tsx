import TypingGame from './components/game/TypingGame';

const App = () => {
  return (
    <div>
      <header>
        <h1>タイピングマスター</h1>
        <p>タイピングスキル向上のためのシンプルなゲーム</p>
      </header>

      <TypingGame />

      <footer>
        <p>© 2025 タイピングマスター</p>
      </footer>
    </div>
  );
};

export default App;
