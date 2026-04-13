import { useTunerPrototype } from "../features/tuner/model";
import { TunerLandingScreen } from "../features/tuner/ui/TunerLandingScreen";

export function App() {
  const { state, startTuning, resetSession, isStarting } = useTunerPrototype();

  return (
    <TunerLandingScreen
      state={state}
      isStarting={isStarting}
      onStart={startTuning}
      onReset={resetSession}
    />
  );
}

export default App;
