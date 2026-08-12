import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DragToConfirmButton } from './DragToConfirmButton'

// jsdom lays out everything at 0x0 by default — stub the track/handle widths
// so the drag-distance math has something real to work with.
function stubLayout(trackWidth: number, handleWidth: number) {
  const track = screen.getByRole('button').parentElement as HTMLElement
  Object.defineProperty(track, 'offsetWidth', { value: trackWidth, configurable: true })
  Object.defineProperty(screen.getByRole('button'), 'offsetWidth', { value: handleWidth, configurable: true })
}

// This project's jsdom has no PointerEvent support at all (not just a
// missing constructor — `'PointerEvent' in window` is false), so
// fireEvent.pointerX can't carry clientX correctly. DOM event dispatch
// matches listeners by event.type, not by which constructor built the
// event, so a MouseEvent typed "pointerdown"/etc. reaches the same
// onPointerDown/etc. React handlers a real PointerEvent would, with clientX
// intact (MouseEvent's init dict supports it; a plain Event's doesn't).
// pointerId is tacked on afterward since MouseEvent's init dict has no slot
// for it — component reads it as a plain property, same either way.
//
// Each dispatch is wrapped in its own act() — fireEvent/userEvent do this
// automatically, but a raw dispatchEvent() doesn't, so without it
// pointerdown's setDragging(true) hasn't actually committed yet by the time
// pointermove fires, and pointermove's handler still reads the stale
// dragging=false from the previous render and skips updating dragX.
function firePointerDrag(clientXStart: number, clientXEnd: number) {
  const handle = screen.getByRole('button')
  const down = new MouseEvent('pointerdown', { clientX: clientXStart, bubbles: true })
  const move = new MouseEvent('pointermove', { clientX: clientXEnd, bubbles: true })
  const up = new MouseEvent('pointerup', { clientX: clientXEnd, bubbles: true })
  for (const e of [down, move, up]) Object.defineProperty(e, 'pointerId', { value: 1 })
  act(() => handle.dispatchEvent(down))
  act(() => handle.dispatchEvent(move))
  act(() => handle.dispatchEvent(up))
}

describe('DragToConfirmButton', () => {
  it('does not confirm on a plain tap/click with no drag', async () => {
    const onConfirm = vi.fn()
    render(<DragToConfirmButton label="Drag to place order" pendingLabel="Placing…" onConfirm={onConfirm} />)
    stubLayout(300, 50)

    await userEvent.click(screen.getByRole('button', { name: 'Drag to place order' }))

    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not confirm when dragged less than the completion threshold', () => {
    const onConfirm = vi.fn()
    render(<DragToConfirmButton label="Drag to place order" pendingLabel="Placing…" onConfirm={onConfirm} />)
    stubLayout(300, 50)

    firePointerDrag(0, 100) // 100/250 well under the 0.85 threshold

    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('confirms once dragged past the completion threshold', () => {
    const onConfirm = vi.fn()
    render(<DragToConfirmButton label="Drag to place order" pendingLabel="Placing…" onConfirm={onConfirm} />)
    stubLayout(300, 50)

    firePointerDrag(0, 240) // 240/250, past the 0.85 threshold

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('confirms directly on a keyboard Enter/Space activation, no drag required', async () => {
    const onConfirm = vi.fn()
    render(<DragToConfirmButton label="Drag to place order" pendingLabel="Placing…" onConfirm={onConfirm} />)
    stubLayout(300, 50)

    await userEvent.tab() // focuses the handle button
    await userEvent.keyboard('{Enter}')

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not confirm at all while disabled', () => {
    const onConfirm = vi.fn()
    render(<DragToConfirmButton label="Drag to place order" pendingLabel="Placing…" onConfirm={onConfirm} disabled />)
    stubLayout(300, 50)

    firePointerDrag(0, 240)

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('shows the pending label and locks interaction while pending', () => {
    const onConfirm = vi.fn()
    render(<DragToConfirmButton label="Drag to place order" pendingLabel="Placing order…" onConfirm={onConfirm} pending />)
    stubLayout(300, 50)

    expect(screen.getByText('Placing order…')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()

    firePointerDrag(0, 240)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('resets the handle if pending ends without unmounting (checkout failed)', () => {
    const onConfirm = vi.fn()
    const { rerender } = render(
      <DragToConfirmButton label="Drag to place order" pendingLabel="Placing…" onConfirm={onConfirm} pending />,
    )
    stubLayout(300, 50)

    rerender(<DragToConfirmButton label="Drag to place order" pendingLabel="Placing…" onConfirm={onConfirm} pending={false} />)

    expect(screen.getByText('Drag to place order')).toBeInTheDocument()
    expect(screen.getByRole('button')).not.toBeDisabled()
  })
})
