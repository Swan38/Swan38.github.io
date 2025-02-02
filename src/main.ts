import SVGInjector from "svg-injector"

import './style.css'

import { Participant, History, Group, Next } from "./components"
import { Cookie } from "./cookies"


SVGInjector(document.querySelectorAll(`img[class="tab_selection_image"]`))

// Get HTML elements
const tutorial: HTMLDivElement = document.getElementById('tutorial') as HTMLDivElement
const tab_layout: HTMLDivElement = document.getElementById('tab_layout') as HTMLDivElement

const container_participants: HTMLElement = document.getElementById(`container_participants`)!
const participant_list = new Participant.Editor()
container_participants.insertAdjacentElement('beforeend', participant_list.get_elem())

const container_history: HTMLElement = document.getElementById(`container_history`)!
const history = new History.Editor(participant_list)
container_history.insertAdjacentElement('beforeend', history.get_elem())

const container_groups: HTMLElement = document.getElementById(`container_groups`)!
const group_list = new Group.Editor(participant_list)
container_groups.insertAdjacentElement('beforeend', group_list.get_elem())

const container_next: HTMLElement = document.getElementById(`container_next_christmas`)!
const next = new Next.Editor(participant_list, history, group_list)
container_next.insertAdjacentElement('beforeend', next.get_elem())

namespace RawData { // Raw data storage
    const RAW_DATA_KEY = 'noel_data'
    type RawDataAgregation = {
        participants: Participant.ParticipantListRawData
        history: History.HistoryRawData
        groups: Group.GroupListRawData
        next: Next.NextRawData
    }
    function write_raw_data(raw_data: RawDataAgregation) {
        if (raw_data.participants.length > 0)
            Cookie.write(RAW_DATA_KEY, JSON.stringify(raw_data))
        else
            Cookie.erase(RAW_DATA_KEY)
    }
    function read_raw_data(): RawDataAgregation | undefined {
        const cookie_value: string | undefined = Cookie.read(RAW_DATA_KEY)
        if (cookie_value === undefined)
            return undefined
        else
            return JSON.parse(cookie_value)
    }
    export function is_raw_data_stored() {
        return Cookie.read(RAW_DATA_KEY) !== undefined
    }

    function store_raw_data() {
        const raw_data: RawDataAgregation = {
            participants: participant_list.get_raw_data(),
            history: history.get_raw_data(),
            groups: group_list.get_raw_data(),
            next: next.get_raw_data(),
        }
        write_raw_data(raw_data)
    }
    let debounce_store_data_timeout: number | undefined = undefined
    function debounce_store_raw_data(timeout_ms: number = 500) {
        clearTimeout(debounce_store_data_timeout)
        debounce_store_data_timeout = setTimeout(() => {
            debounce_store_data_timeout = undefined
            store_raw_data()
        }, timeout_ms)
    }

    export function setup_raw_data() {
        const raw_data: RawDataAgregation | undefined = read_raw_data()
        if (raw_data === undefined) return;

        participant_list.set_from_raw_data(raw_data.participants)
        history.set_from_raw_data(raw_data.history)
        group_list.set_from_raw_data(raw_data.groups)
        next.set_from_raw_data(raw_data.next)
    }

    participant_list.addEventListener('update', () => { debounce_store_raw_data() })
    history.addEventListener('update', () => { debounce_store_raw_data(0) })
    group_list.addEventListener('update', () => { debounce_store_raw_data(0) })
    next.addEventListener('update', () => { debounce_store_raw_data() })
}

{ // Tutorial or main app
    if (RawData.is_raw_data_stored()) {
        tutorial.style.display = 'none'
        RawData.setup_raw_data()
    }
    else
        tab_layout.style.display = 'none';

    (document.getElementById('start_button') as HTMLButtonElement).onclick = () => {
        tutorial.classList.add('disappear')
        setTimeout(() => {
            tutorial.style.display = 'none'
            tab_layout.style.display = ''
            tab_layout.classList.add('appear')
        }, 500)
    }
}

{ // Drop file area
    const drop_area: HTMLLabelElement = document.getElementById('file_input_label') as HTMLLabelElement
    const drop_input: HTMLInputElement = drop_area.querySelector('input[type="file"]')!

    drop_area.ondragenter = () => { drop_area.setAttribute('hover_drop', '') }
    drop_area.ondragleave = (event) => { console.log(event); drop_area.removeAttribute('hover_drop') }
    drop_area.ondragover = drop_area.ondragenter = (event) => { event.preventDefault() }

    drop_area.ondrop = (event) => {
        drop_input.files = event.dataTransfer?.files || null
        event.preventDefault()
    }
}

{ // Persistent tabs
    { // Set begin value
        const selected_tab = Cookie.read('selected_tab')
        if (selected_tab !== undefined)
            (document.querySelector(`#tab_layout input[type="radio"][name="tab_selection"][value="${selected_tab}"]`) as HTMLInputElement).checked = true
    }

    for (const tab_input of document.querySelectorAll(`#tab_layout input[type="radio"][name="tab_selection"]`)) {
        (tab_input as HTMLInputElement).addEventListener('change', (event) => {
            Cookie.write('selected_tab', (event.target as HTMLInputElement).value, 365 / 2)
        })
    }
}
