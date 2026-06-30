import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore'
import { db } from '../firebase'
import '../Calendar.css'

export const TEAM_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function TeamsModal({ onClose }) {
  const [teams,       setTeams]       = useState([])
  const [expandedId,  setExpandedId]  = useState(null)
  const [newName,     setNewName]     = useState('')
  const [newColor,    setNewColor]    = useState(TEAM_COLORS[0])
  const [memberForms, setMemberForms] = useState({})

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'teams'), orderBy('createdAt')),
      snap => setTeams(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
      () => {}
    )
    return unsub
  }, [])

  const addTeam = async () => {
    if (!newName.trim()) return
    const ref = await addDoc(collection(db, 'teams'), {
      name: newName.trim(), color: newColor, members: [], createdAt: Date.now(),
    })
    setNewName('')
    setExpandedId(ref.id)
  }

  const deleteTeam = async (id) => {
    if (window.confirm('¿Eliminar este equipo?')) {
      await deleteDoc(doc(db, 'teams', id))
      if (expandedId === id) setExpandedId(null)
    }
  }

  const setForm = (teamId, field, val) =>
    setMemberForms(prev => ({ ...prev, [teamId]: { ...(prev[teamId] || {}), [field]: val } }))

  const addMember = async (team) => {
    const f = memberForms[team.id] || {}
    if (!f.name?.trim() || !f.email?.trim()) return
    const member = { id: crypto.randomUUID(), name: f.name.trim(), email: f.email.trim().toLowerCase() }
    await updateDoc(doc(db, 'teams', team.id), { members: [...(team.members || []), member] })
    setMemberForms(prev => ({ ...prev, [team.id]: { name: '', email: '' } }))
  }

  const removeMember = async (team, memberId) =>
    updateDoc(doc(db, 'teams', team.id), {
      members: (team.members || []).filter(m => m.id !== memberId),
    })

  return (
    <div className="cal-modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="cal-modal cal-modal--teams">
        <div className="cal-modal__head">
          <h3 className="cal-modal__title">Equipos</h3>
          <button className="cal-modal__close" type="button" onClick={onClose}>✕</button>
        </div>

        <div className="cal-teams-body">
          {teams.length === 0 && (
            <p className="cal-teams-empty">No hay equipos todavía. Creá el primero abajo.</p>
          )}

          {teams.map(team => (
            <div key={team.id} className="cal-team">
              <div
                className="cal-team__head"
                onClick={() => setExpandedId(expandedId === team.id ? null : team.id)}
              >
                <span className="cal-team__dot" style={{ background: team.color }} />
                <span className="cal-team__name">{team.name}</span>
                <span className="cal-team__count">{(team.members || []).length} persona{(team.members || []).length !== 1 ? 's' : ''}</span>
                <button
                  className="cal-team__del-btn"
                  type="button"
                  title="Eliminar equipo"
                  onClick={e => { e.stopPropagation(); deleteTeam(team.id) }}
                >
                  ✕
                </button>
                <span className={`cal-team__chevron${expandedId === team.id ? ' cal-team__chevron--open' : ''}`}>›</span>
              </div>

              {expandedId === team.id && (
                <div className="cal-team__body">
                  {(team.members || []).length === 0 ? (
                    <p className="cal-team__empty">Sin miembros todavía.</p>
                  ) : (
                    <ul className="cal-team__members">
                      {(team.members || []).map(m => (
                        <li key={m.id} className="cal-team__member">
                          <div className="cal-team__member-info">
                            <span className="cal-team__member-name">{m.name}</span>
                            <span className="cal-team__member-email">{m.email}</span>
                          </div>
                          <button
                            className="cal-team__member-del"
                            type="button"
                            title="Quitar miembro"
                            onClick={() => removeMember(team, m.id)}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="cal-team__add-form">
                    <input
                      type="text"
                      placeholder="Nombre"
                      value={(memberForms[team.id] || {}).name || ''}
                      onChange={e => setForm(team.id, 'name', e.target.value)}
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={(memberForms[team.id] || {}).email || ''}
                      onChange={e => setForm(team.id, 'email', e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addMember(team)}
                    />
                    <button
                      type="button"
                      className="cal-team__add-btn"
                      onClick={() => addMember(team)}
                      disabled={!(memberForms[team.id]?.name?.trim()) || !(memberForms[team.id]?.email?.trim())}
                    >
                      + Agregar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="cal-teams-footer">
          <div className="cal-teams-new">
            <input
              type="text"
              placeholder="Nombre del nuevo equipo..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTeam()}
            />
            <div className="cal-color-swatches">
              {TEAM_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`cal-color-swatch${newColor === c ? ' cal-color-swatch--active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={addTeam}
              disabled={!newName.trim()}
            >
              Crear equipo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
