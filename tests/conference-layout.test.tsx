import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useConferenceLayout } from '@/features/conference/hooks/useConferenceLayout';

afterEach(cleanup);
it('changes pagination at the shared breakpoint and clears a removed pinned widget',()=>{
  const dispatch=vi.fn();
  const context={space:{name:'space'},selfRoom:{name:'room'},tilePlayerItems:[{id:'whiteboard'}],focusedTilePlayerId:'whiteboard',isTilePlayerFocused:true,trackEntities:[],focusedTrackEntity:null,device:'phone',layoutContext:{pin:{dispatch}},ref:{current:null},clearRoom:vi.fn()};
  const {result,rerender}=renderHook(({model})=>useConferenceLayout(model as any),{initialProps:{model:context}});
  expect(result.current.unifiedPageSize).toBe(4);
  expect(result.current.unifiedFocusEntity?.id).toBe('tile-player:whiteboard');
  rerender({model:{...context,device:'pc'}});
  expect(result.current.unifiedPageSize).toBe(5);
  rerender({model:{...context,tilePlayerItems:[]}});
  expect(result.current.unifiedFocusEntity).toBeNull();
  expect(dispatch).toHaveBeenCalledWith({msg:'clear_pin'});
});
