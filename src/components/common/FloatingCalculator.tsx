import React, { useState, useEffect, useRef } from 'react';
import {
  Calculator as CalculatorIcon,
  X,
  Minus,
  RotateCcw,
  Copy,
  Check,
  Percent,
  Delete,
  History,
  CornerDownLeft,
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';

interface FloatingCalculatorProps {
  initialOpen?: boolean;
}

export const FloatingCalculator: React.FC<FloatingCalculatorProps> = ({ initialOpen = false }) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForNewOperand, setWaitingForNewOperand] = useState(false);
  const [historyList, setHistoryList] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  // Position state for floating drag or bottom-right anchoring
  const [position, setPosition] = useState<{ x?: number; y?: number }>({});

  const handleDigit = (digit: string) => {
    if (waitingForNewOperand) {
      setDisplay(digit);
      setWaitingForNewOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const handleDecimal = () => {
    if (waitingForNewOperand) {
      setDisplay('0.');
      setWaitingForNewOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperator(null);
    setWaitingForNewOperand(false);
  };

  const handleBackspace = () => {
    if (waitingForNewOperand) return;
    if (display.length === 1 || (display.length === 2 && display.startsWith('-'))) {
      setDisplay('0');
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const handleToggleSign = () => {
    const value = parseFloat(display);
    if (!isNaN(value)) {
      setDisplay(String(-value));
    }
  };

  const handlePercent = () => {
    const value = parseFloat(display);
    if (isNaN(value)) return;

    if (previousValue !== null && operator) {
      if (operator === '+' || operator === '-') {
        // e.g. 1000 + 15% => 150 (amount of increase/decrease)
        const percentageValue = (previousValue * value) / 100;
        setDisplay(String(percentageValue));
      } else if (operator === '×' || operator === '*') {
        // e.g. 500 * 20% => 100
        const percentageValue = (previousValue * value) / 100;
        setDisplay(String(percentageValue));
      } else if (operator === '÷' || operator === '/') {
        // e.g. 50 ÷ 200 % => 25 (% that 50 represents of 200)
        const percentageValue = previousValue !== 0 ? (value / previousValue) * 100 : 0;
        setDisplay(String(Math.round(percentageValue * 100) / 100));
      } else if (operator === '÷%') {
        const percentageValue = previousValue !== 0 ? (value / previousValue) * 100 : 0;
        setDisplay(String(Math.round(percentageValue * 100) / 100));
      }
    } else {
      const result = value / 100;
      setDisplay(String(result));
    }
  };

  const handleRatioPercentage = () => {
    const currentVal = parseFloat(display) || 0;
    if (previousValue !== null && previousValue !== 0) {
      // Calculate what % currentVal is of previousValue
      const ratio = (currentVal / previousValue) * 100;
      const rounded = Math.round(ratio * 100) / 100;
      const equation = `${currentVal} es el ${rounded}% de ${previousValue}`;
      setHistoryList((prev) => [equation, ...prev.slice(0, 9)]);
      setDisplay(String(rounded));
      setPreviousValue(null);
      setOperator(null);
      setWaitingForNewOperand(true);
    } else {
      // Set current display as the base and wait for the second operand
      setPreviousValue(currentVal);
      setOperator('÷%');
      setWaitingForNewOperand(true);
    }
  };

  const applyDirectPercentage = (percentNum: number, isAddition: boolean = true) => {
    const currentValue = parseFloat(display) || 0;
    if (currentValue === 0) return;
    const calc = isAddition
      ? currentValue * (1 + percentNum / 100)
      : currentValue * (1 - percentNum / 100);
    const equation = `${currentValue} ${isAddition ? '+' : '-'}${percentNum}% = ${calc}`;
    setHistoryList((prev) => [equation, ...prev.slice(0, 9)]);
    setDisplay(String(Math.round(calc * 100) / 100));
    setPreviousValue(null);
    setOperator(null);
    setWaitingForNewOperand(true);
  };

  const performCalculation = (nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operator) {
      const currentValue = previousValue || 0;
      let calculatedValue = currentValue;

      switch (operator) {
        case '+':
          calculatedValue = currentValue + inputValue;
          break;
        case '-':
          calculatedValue = currentValue - inputValue;
          break;
        case '×':
        case '*':
          calculatedValue = currentValue * inputValue;
          break;
        case '÷':
        case '/':
          calculatedValue = inputValue !== 0 ? currentValue / inputValue : 0;
          break;
        case '÷%':
          // Calculate what % inputValue represents of currentValue
          calculatedValue = currentValue !== 0 ? (inputValue / currentValue) * 100 : 0;
          break;
        default:
          break;
      }

      // Add to history
      const equation =
        operator === '÷%'
          ? `${inputValue} es el ${Math.round(calculatedValue * 100) / 100}% de ${currentValue}`
          : `${currentValue} ${operator} ${inputValue} = ${calculatedValue}`;
      setHistoryList((prev) => [equation, ...prev.slice(0, 9)]);

      setPreviousValue(calculatedValue);
      setDisplay(String(calculatedValue));
    }

    setWaitingForNewOperand(true);
    setOperator(nextOperator === '=' ? null : nextOperator);
  };

  const handleCopyResult = () => {
    navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // Keyboard navigation support
  useEffect(() => {
    if (!isOpen || isMinimized) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
        handleDigit(e.key);
      } else if (e.key === '.') {
        handleDecimal();
      } else if (e.key === '+') {
        performCalculation('+');
      } else if (e.key === '-') {
        performCalculation('-');
      } else if (e.key === '*') {
        performCalculation('×');
      } else if (e.key === '/') {
        e.preventDefault();
        performCalculation('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        performCalculation('=');
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === '%') {
        e.preventDefault();
        handlePercent();
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMinimized, display, operator, previousValue, waitingForNewOperand]);

  return (
    <>
      {/* Floating Action Button (Always Accessible) */}
      {!isOpen && (
        <button
          id="btn-floating-calculator"
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-20 sm:bottom-6 right-5 z-40 p-3.5 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-full shadow-2xl border-2 border-white/20 flex items-center gap-2 group transition-transform active:scale-95 cursor-pointer accent-glow hover:scale-105"
          title="Calculadora Rápida XAF"
          aria-label="Abrir Calculadora"
        >
          <CalculatorIcon className="w-5 h-5 transition-transform group-hover:rotate-6" />
          <span className="hidden sm:inline-block text-xs font-black uppercase tracking-wider font-display pr-1">
            Calculadora
          </span>
        </button>
      )}

      {/* Floating Calculator Window */}
      {isOpen && (
        <div
          id="floating-calculator-window"
          className={`fixed z-50 transition-all duration-200 shadow-2xl border border-white/20 bg-[#0a0a0a] rounded-xl overflow-hidden ${
            isMinimized
              ? 'bottom-20 sm:bottom-6 right-5 w-64'
              : 'bottom-16 sm:bottom-6 right-4 sm:right-6 w-[320px] max-w-[calc(100vw-2rem)]'
          }`}
        >
          {/* Header Bar */}
          <div className="bg-[#dc2626] text-white px-3.5 py-2.5 flex items-center justify-between select-none">
            <div className="flex items-center gap-2">
              <CalculatorIcon className="w-4 h-4 text-white" />
              <span className="text-xs font-black uppercase tracking-wider font-display">
                Calculadora XAF
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-1 rounded hover:bg-black/20 text-white transition-colors cursor-pointer ${
                  showHistory ? 'bg-black/30' : ''
                }`}
                title="Historial de cálculos"
              >
                <History className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 rounded hover:bg-black/20 text-white transition-colors cursor-pointer"
                title={isMinimized ? 'Expandir' : 'Minimizar'}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-black/20 text-white transition-colors cursor-pointer"
                title="Cerrar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <div className="p-3 bg-[#0d0d0d] text-white">
              {/* History Dropdown */}
              {showHistory && (
                <div className="mb-2 p-2 bg-[#171717] rounded-md max-h-32 overflow-y-auto text-[11px] font-mono border border-white/10 space-y-1">
                  <div className="flex items-center justify-between text-white/50 text-[10px] pb-1 border-b border-white/10">
                    <span>HISTORIAL RECIENTE</span>
                    <button
                      onClick={() => setHistoryList([])}
                      className="text-[#ef4444] hover:underline cursor-pointer"
                    >
                      Borrar
                    </button>
                  </div>
                  {historyList.length === 0 ? (
                    <p className="text-white/40 italic text-center py-2">Sin operaciones previas</p>
                  ) : (
                    historyList.map((item, idx) => (
                      <div key={idx} className="text-white/80 hover:text-white transition-colors">
                        {item}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Display Screen */}
              <div className="bg-[#141414] rounded-lg p-3 mb-3 border border-white/10 text-right">
                <div className="text-[10px] font-mono text-white/40 h-4 overflow-hidden truncate">
                  {previousValue !== null && operator ? `${previousValue} ${operator}` : ''}
                </div>
                <div className="text-2xl font-black font-mono tracking-tight text-white truncate my-0.5">
                  {display}
                </div>
                <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/5 text-[10px] font-mono">
                  <span className="text-[#ef4444] font-bold">
                    ≈ {formatCurrency(parseFloat(display) || 0)}
                  </span>
                  <button
                    onClick={handleCopyResult}
                    className="flex items-center gap-1 text-white/50 hover:text-white transition-colors cursor-pointer"
                    title="Copiar resultado al portapapeles"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Percentages / Tax Bar */}
              <div className="grid grid-cols-5 gap-1 mb-2 font-mono text-[9px] font-bold">
                <button
                  onClick={() => applyDirectPercentage(15, true)}
                  className="py-1 px-1 bg-[#dc2626]/20 hover:bg-[#dc2626] border border-[#dc2626]/40 text-[#ef4444] hover:text-white rounded text-center transition-colors cursor-pointer"
                  title="Añadir 15% de IVA"
                >
                  +15% IVA
                </button>
                <button
                  onClick={() => applyDirectPercentage(10, false)}
                  className="py-1 px-1 bg-amber-500/20 hover:bg-amber-600 border border-amber-500/40 text-amber-400 hover:text-white rounded text-center transition-colors cursor-pointer"
                  title="Descontar 10%"
                >
                  -10% DESC
                </button>
                <button
                  onClick={() => applyDirectPercentage(5, false)}
                  className="py-1 px-1 bg-emerald-500/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-400 hover:text-white rounded text-center transition-colors cursor-pointer"
                  title="Descontar 5%"
                >
                  -5% DESC
                </button>
                <button
                  onClick={handleRatioPercentage}
                  className="py-1 px-1 bg-purple-500/20 hover:bg-purple-600 border border-purple-500/40 text-purple-300 hover:text-white rounded text-center transition-colors cursor-pointer"
                  title="Calcular qué % representa una cantidad de otra (A de B)"
                >
                  % de Base
                </button>
                <button
                  onClick={handlePercent}
                  className="py-1 px-1 bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 hover:text-white rounded text-center flex items-center justify-center gap-0.5 transition-colors cursor-pointer"
                  title="Calcular % del valor actual"
                >
                  <Percent className="w-2.5 h-2.5" />
                  <span>% Tasa</span>
                </button>
              </div>

              {/* Keypad Grid */}
              <div className="grid grid-cols-4 gap-1.5 font-mono text-sm">
                {/* Row 1 */}
                <button
                  onClick={handleClear}
                  className="p-2.5 bg-white/10 hover:bg-white/20 text-[#ef4444] font-black rounded cursor-pointer transition-colors active:scale-95"
                >
                  C
                </button>
                <button
                  onClick={handleBackspace}
                  className="p-2.5 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded cursor-pointer flex items-center justify-center transition-colors active:scale-95"
                  title="Borrar último"
                >
                  <Delete className="w-4 h-4" />
                </button>
                <button
                  onClick={handlePercent}
                  className="p-2.5 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded cursor-pointer flex items-center justify-center transition-colors active:scale-95"
                >
                  <Percent className="w-4 h-4" />
                </button>
                <button
                  onClick={() => performCalculation('÷')}
                  className={`p-2.5 rounded font-black cursor-pointer transition-colors active:scale-95 ${
                    operator === '÷'
                      ? 'bg-[#dc2626] text-white shadow-md'
                      : 'bg-white/15 hover:bg-[#dc2626] hover:text-white text-white'
                  }`}
                >
                  ÷
                </button>

                {/* Row 2 */}
                <button
                  onClick={() => handleDigit('7')}
                  className="p-2.5 bg-white/5 hover:bg-white/15 text-white font-bold rounded cursor-pointer transition-colors active:scale-95"
                >
                  7
                </button>
                <button
                  onClick={() => handleDigit('8')}
                  className="p-2.5 bg-white/5 hover:bg-white/15 text-white font-bold rounded cursor-pointer transition-colors active:scale-95"
                >
                  8
                </button>
                <button
                  onClick={() => handleDigit('9')}
                  className="p-2.5 bg-white/5 hover:bg-white/15 text-white font-bold rounded cursor-pointer transition-colors active:scale-95"
                >
                  9
                </button>
                <button
                  onClick={() => performCalculation('×')}
                  className={`p-2.5 rounded font-black cursor-pointer transition-colors active:scale-95 ${
                    operator === '×'
                      ? 'bg-[#dc2626] text-white shadow-md'
                      : 'bg-white/15 hover:bg-[#dc2626] hover:text-white text-white'
                  }`}
                >
                  ×
                </button>

                {/* Row 3 */}
                <button
                  onClick={() => handleDigit('4')}
                  className="p-2.5 bg-white/5 hover:bg-white/15 text-white font-bold rounded cursor-pointer transition-colors active:scale-95"
                >
                  4
                </button>
                <button
                  onClick={() => handleDigit('5')}
                  className="p-2.5 bg-white/5 hover:bg-white/15 text-white font-bold rounded cursor-pointer transition-colors active:scale-95"
                >
                  5
                </button>
                <button
                  onClick={() => handleDigit('6')}
                  className="p-2.5 bg-white/5 hover:bg-white/15 text-white font-bold rounded cursor-pointer transition-colors active:scale-95"
                >
                  6
                </button>
                <button
                  onClick={() => performCalculation('-')}
                  className={`p-2.5 rounded font-black cursor-pointer transition-colors active:scale-95 ${
                    operator === '-'
                      ? 'bg-[#dc2626] text-white shadow-md'
                      : 'bg-white/15 hover:bg-[#dc2626] hover:text-white text-white'
                  }`}
                >
                  -
                </button>

                {/* Row 4 */}
                <button
                  onClick={() => handleDigit('1')}
                  className="p-2.5 bg-white/5 hover:bg-white/15 text-white font-bold rounded cursor-pointer transition-colors active:scale-95"
                >
                  1
                </button>
                <button
                  onClick={() => handleDigit('2')}
                  className="p-2.5 bg-white/5 hover:bg-white/15 text-white font-bold rounded cursor-pointer transition-colors active:scale-95"
                >
                  2
                </button>
                <button
                  onClick={() => handleDigit('3')}
                  className="p-2.5 bg-white/5 hover:bg-white/15 text-white font-bold rounded cursor-pointer transition-colors active:scale-95"
                >
                  3
                </button>
                <button
                  onClick={() => performCalculation('+')}
                  className={`p-2.5 rounded font-black cursor-pointer transition-colors active:scale-95 ${
                    operator === '+'
                      ? 'bg-[#dc2626] text-white shadow-md'
                      : 'bg-white/15 hover:bg-[#dc2626] hover:text-white text-white'
                  }`}
                >
                  +
                </button>

                {/* Row 5 */}
                <button
                  onClick={handleToggleSign}
                  className="p-2.5 bg-white/5 hover:bg-white/15 text-white/70 font-bold rounded cursor-pointer transition-colors active:scale-95"
                >
                  ±
                </button>
                <button
                  onClick={() => handleDigit('0')}
                  className="p-2.5 bg-white/5 hover:bg-white/15 text-white font-bold rounded cursor-pointer transition-colors active:scale-95"
                >
                  0
                </button>
                <button
                  onClick={handleDecimal}
                  className="p-2.5 bg-white/5 hover:bg-white/15 text-white font-bold rounded cursor-pointer transition-colors active:scale-95"
                >
                  .
                </button>
                <button
                  onClick={() => performCalculation('=')}
                  className="p-2.5 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black rounded cursor-pointer transition-colors active:scale-95 shadow-md flex items-center justify-center"
                >
                  <CornerDownLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
