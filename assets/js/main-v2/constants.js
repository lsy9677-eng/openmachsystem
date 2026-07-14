export const VERSION = '1.0.0';
export const STORAGE_KEY = '230MATCH_MAIN_V2_STATE';
export const STATUS = Object.freeze({
  WAITING_SLOTS: 'waiting_slots',
  UNASSIGNED: 'unassigned',
  SHARED: 'shared_queue',
  WAIT1: 'court_wait1',
  PLAYING: 'playing',
  COMPLETED: 'completed'
});
export const ROUND_NAMES = Object.freeze({
  64:'64강',32:'32강',16:'16강',8:'8강',4:'준결승',2:'결승'
});
