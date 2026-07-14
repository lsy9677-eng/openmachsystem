import {STORAGE_KEY} from './constants.js';
import {clone} from './utils.js';

export class Store{
  constructor(initial){this.state=initial;this.listeners=new Set();}
  get(){return this.state;}
  set(next,{persist=true}={}){this.state=next;if(persist)this.persist();this.emit();}
  update(mutator,{persist=true}={}){const next=clone(this.state);mutator(next);this.set(next,{persist});}
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  emit(){for(const fn of this.listeners)fn(this.state);}
  persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(this.state));}
  load(){const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return false;this.state=JSON.parse(raw);this.emit();return true;}
  clear(){localStorage.removeItem(STORAGE_KEY);}
}
