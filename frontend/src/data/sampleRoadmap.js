// A pre-built roadmap so a fresh install can open straight onto the lit
// timeline. Phases 1-2 arrive completed, putting the traveling light on
// phase 3. Never written to localStorage; the id is recognised nowhere,
// so progress edits stay ephemeral.
const sampleRoadmap = {
  id: 'sample-gimbal',
  saved_at: '2026-06-09T17:42:00.000Z',
  completed: [1, 2],
  notes: {},
  project_data: {
    name: 'Self-balancing camera gimbal',
    preset_type: 'HARDWARE',
    description:
      'A 2-axis brushless gimbal for a mirrorless camera, built from scratch: custom brackets, BLDC motors with encoder feedback, and a tuned PID loop.',
    timeline: '1–3 months',
    experience_level: 'Intermediate',
    team_size: 'Solo',
    resources: ['Moderate budget', 'Lab/workshop access'],
    success_criteria: 'Smooth handheld footage walking down stairs',
  },
  roadmap: {
    project_name: 'Self-balancing camera gimbal',
    preset_type: 'HARDWARE',
    estimated_duration: '9–12 weeks',
    generated_at: '2026-06-09T17:41:21.000Z',
    summary:
      'A 2-axis brushless camera gimbal built around an STM32 running a 1kHz PID loop. The plan front-loads motor characterisation — the highest-risk unknown — and gets stabilised footage by week six, leaving the back third for tuning and the handle build.',
    success_criteria:
      'Footage shot walking down stairs shows no visible horizon drift; roll stays within ±0.4° during a 10-minute handheld take.',
    early_validation:
      'Before any CAD: drive one GB2208 motor open-loop from the dev board and verify it can hold a 350g dummy mass level against a finger push. If it can’t, the motor budget changes and so does the frame.',
    critical_path: [
      'Motor characterisation rig',
      'Control loop bring-up',
      'Frame v2 and integration',
      'Field tuning',
    ],
    phases: [
      {
        phase_number: 1,
        title: 'Parts selection and ordering',
        description:
          'Lock the BOM around the camera’s 620g measured weight: two GB2208 gimbal motors, AS5600 magnetic encoders, an STM32G431 dev board, and a 3S 18650 pack. Order long-lead items first; the encoders ship from overseas.',
        duration: '1 week',
        dependencies: [],
        checkpoints: [
          'BOM total stays under the $240 parts budget',
          'Camera + lens weighed on a scale, not taken from spec sheets',
          'All vendor order confirmations in the project folder',
        ],
        risks: [
          'AS5600 breakout boards from marketplace sellers often have the magnet glued off-centre — order one spare per axis',
        ],
        tools_required: ['GB2208 motors ×2', 'AS5600 encoders ×3', 'STM32G431 Nucleo', 'Digital scale'],
        tags: ['quick-win', 'dependency'],
        confidence: 0.93,
      },
      {
        phase_number: 2,
        title: 'Motor characterisation rig',
        description:
          'Bolt one motor to a bench plate with a 350g dummy arm and map torque against drive current using simple FOC. This is the experiment the whole project hangs on — it tells you whether the GB2208s can hold the real camera.',
        duration: '1–2 weeks',
        dependencies: ['Parts selection and ordering — can’t characterise motors that haven’t arrived'],
        checkpoints: [
          'Motor holds the 350g arm horizontal at ≤60% of rated current',
          'Encoder reads a full 360° sweep with no dead zones',
          'Stall temperature stays under 55°C after 5 minutes of holding torque',
        ],
        risks: [
          'GB2208 torque may be marginal for the 620g camera at full extension — if phase current exceeds 70% holding level, step up to GB4108 motors before cutting any frame parts',
        ],
        tools_required: ['SimpleFOC library', 'Bench power supply', 'IR thermometer', 'M3 hardware kit'],
        sources: [
          { label: 'SimpleFOC docs', url: 'https://docs.simplefoc.com' },
          { label: 'AS5600 datasheet', url: 'https://ams.com/as5600' },
        ],
        tags: ['critical-path', 'research', 'high-risk'],
        confidence: 0.78,
      },
      {
        phase_number: 3,
        title: 'Control loop bring-up',
        description:
          'Wire the IMU and both encoders to the STM32 and close the roll-axis loop first. Start with a conservative PI controller at 500Hz, then push to 1kHz once the I2C bus stops being the bottleneck.',
        duration: '2–3 weeks',
        dependencies: ['Motor characterisation rig — loop gains start from the measured torque constant'],
        checkpoints: [
          'Roll axis returns to level within 300ms after a 15° disturbance',
          'No audible oscillation at rest (gains below the hunting threshold)',
          'IMU-to-motor latency measured under 2ms at 1kHz',
        ],
        risks: [
          'Running two AS5600s plus the MPU-6050 on one I2C bus caps the loop near 600Hz — plan for the second I2C peripheral or an SPI IMU',
        ],
        tools_required: ['MPU-6050 IMU', 'STM32CubeIDE', 'Logic analyzer', 'PlatformIO'],
        sources: [
          {
            label: 'STM32G431 reference',
            url: 'https://www.st.com/en/microcontrollers-microprocessors/stm32g431cb.html',
          },
        ],
        tags: ['critical-path', 'build'],
        confidence: 0.71,
      },
      {
        phase_number: 4,
        title: 'Frame v2 and integration',
        description:
          'Replace the bench plate with printed PETG brackets sized from the v1 lessons: shorter roll arm, cable channels, and a balance-adjust slot so the camera’s centre of mass sits on the roll axis before the controller ever fights it.',
        duration: '2 weeks',
        dependencies: ['Control loop bring-up — bracket geometry depends on the working motor orientation'],
        checkpoints: [
          'Camera balances power-off within 5° on both axes (mechanical balance before electronic)',
          'Total moving mass under 1.1kg including camera',
          'No cable snags through full ±45° travel on both axes',
        ],
        risks: [
          'PETG brackets may flex enough to add ~2Hz resonance into the roll loop — print the motor mounts at 80% infill and retune if the loop hunts',
        ],
        tools_required: ['Prusa MK4 (PETG)', 'Fusion 360', 'M3 threaded inserts', 'Soldering iron'],
        tags: ['critical-path', 'build'],
        confidence: 0.82,
      },
      {
        phase_number: 5,
        title: 'Field tuning',
        description:
          'Take it off the bench. Walk, jog, and descend stairs with logging on; tune the feed-forward against real gait disturbance instead of bench taps. Lock gains when the stair test passes twice in a row.',
        duration: '1–2 weeks',
        dependencies: ['Frame v2 and integration — field tuning on the bench frame just retunes the wrong mass'],
        checkpoints: [
          'Stair-descent clip shows roll within ±0.4° for the full take',
          'Battery delivers a 38-minute continuous run at field current draw',
          'Gains survive a cold restart with no retuning',
        ],
        risks: [
          'Footstep harmonics near 4Hz can excite the roll loop where bench tests never did — log every run so the bad gains are reproducible',
        ],
        tools_required: ['SD logger breakout', 'Phone slow-mo for verification', 'Spare 3S pack'],
        tags: ['critical-path', 'test'],
        confidence: 0.69,
      },
      {
        phase_number: 6,
        title: 'Handle, battery bay, and finish',
        description:
          'Print the handle with the battery bay below the grip so the pack’s 187g acts as a counterweight. Add the power switch, a status LED on the loop-health pin, and strain relief on every cable that crosses an axis.',
        duration: '1 week',
        dependencies: ['Field tuning — handle geometry uses the final balanced mass'],
        checkpoints: [
          'One-handed hold stays comfortable for a full 10-minute take',
          'Pack swap takes under 30 seconds without tools',
          'Final all-up weight logged against the 1.6kg target',
        ],
        risks: [
          'Grip-transmitted hand tremor is a new disturbance band (~8Hz) the stair tests never produced — expect one last gain pass',
        ],
        tools_required: ['Prusa MK4 (TPU grip surface)', 'Rocker switch', 'Heat-shrink kit'],
        tags: ['build', 'deploy'],
        confidence: 0.85,
      },
    ],
  },
}

export default sampleRoadmap
