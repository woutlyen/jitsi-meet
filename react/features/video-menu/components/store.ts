// store.ts
import { compose, createStore } from 'redux';
import Thunk from 'redux-thunk';
import MiddlewareRegistry from '../../base/redux/MiddlewareRegistry';
import PersistenceRegistry from '../../base/redux/PersistenceRegistry';
import ReducerRegistry from '../../base/redux/ReducerRegistry';
import StateListenerRegistry from '../../base/redux/StateListenerRegistry';

const reducer = ReducerRegistry.combineReducers();
const middleware = MiddlewareRegistry.applyMiddleware(Thunk);
const composeEnhancers = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

const store = createStore(
    reducer,
    PersistenceRegistry.getPersistedState(),
    composeEnhancers(middleware)
);

StateListenerRegistry.subscribe(store);

// Optional: global store for legacy access
(window as any).APP = { ...(window as any).APP, store };

export default store;