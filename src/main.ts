import SVGInjector from "svg-injector"

import './style.css'

import { Participant, History, Group, Next, RawData as ComponentRawData, UpdatedDataDetail } from "./components"
import { Cookie } from "./cookies"


SVGInjector(document.querySelectorAll(`img[class="tab_selection_image"]`))

// Get HTML elements
const tutorial: HTMLDivElement = document.getElementById('tutorial') as HTMLDivElement
const tab_layout: HTMLDivElement = document.getElementById('tab_layout') as HTMLDivElement

const container_participants: HTMLElement = document.getElementById(`container_participants`)!
const participant = new Participant.Editor()
container_participants.insertAdjacentElement('beforeend', participant.get_elem())

const container_history: HTMLElement = document.getElementById(`container_history`)!
const history = new History.Editor(participant)
container_history.insertAdjacentElement('beforeend', history.get_elem())

const container_groups: HTMLElement = document.getElementById(`container_groups`)!
const group = new Group.Editor(participant)
container_groups.insertAdjacentElement('beforeend', group.get_elem())

const container_next: HTMLElement = document.getElementById(`container_next_christmas`)!
const next = new Next.Editor(participant, history, group)
container_next.insertAdjacentElement('beforeend', next.get_elem())

namespace RawData { // Raw data storage
    const RAW_DATA_KEY = 'noel_data'
    function write_raw_data(raw_data: ComponentRawData.Agregation) {
        console.log('➕🍪')
        if (raw_data.participants.length > 0)
            Cookie.write(RAW_DATA_KEY, JSON.stringify(raw_data))
        else
            Cookie.erase(RAW_DATA_KEY)
    }
    function read_raw_data(): ComponentRawData.Agregation | undefined {
        const cookie_value: string | undefined = Cookie.read(RAW_DATA_KEY)
        if (cookie_value === undefined)
            return undefined
        else
            return JSON.parse(cookie_value)
    }
    export function is_raw_data_stored() {
        return Cookie.read(RAW_DATA_KEY) !== undefined
    }
    export function setup_raw_data_from_stored() {
        const raw_data: ComponentRawData.Agregation | undefined = read_raw_data()
        if (raw_data === undefined) return;

        ComponentRawData.set_raw_data(
            raw_data,
            participant, history, group, next)
        data_history.register_new_data(raw_data)
    }
    function store_raw_data_cookie_and_history(raw_data: ComponentRawData.Agregation) {
        write_raw_data(raw_data)
        data_history.register_new_data(raw_data)
    }
    export function set_and_store_raw_data(raw_data: ComponentRawData.Agregation) {
        ComponentRawData.set_raw_data(
            raw_data,
            participant, history, group, next)
        store_raw_data_cookie_and_history(raw_data)
    }

    class History {
        #storage: Array<string> // Array<JSON.stringify(ComponentRawData.Agregation)>
        #current_storage_index: number // Used for ctrl + y (ans also then ctrl + z)

        constructor() {
            this.#storage = []
            this.#current_storage_index = NaN
        }

        register_new_data(data: ComponentRawData.Agregation) {
            if (!Number.isNaN(this.#current_storage_index) && this.#current_storage_index != this.#storage.length - 1)
                this.#storage.splice(this.#current_storage_index + 1)

            const data_string = JSON.stringify(data)

            if (!Number.isNaN(this.#current_storage_index) && data_string == this.#storage.at(-1)) {
                console.log('=⌛')
                return;
            }

            this.#storage.push(data_string)
            console.log('➕⌛', data)

            if (this.#storage.length > 60)
                this.#storage.shift()

            this.#current_storage_index = this.#storage.length - 1
        }
        get_ctrl_z_data(): ComponentRawData.Agregation | undefined {
            if (Number.isNaN(this.#current_storage_index) || this.#current_storage_index == 0) return undefined;

            return JSON.parse(this.#storage[--this.#current_storage_index])
        }
        get_ctrl_y_data(): ComponentRawData.Agregation | undefined {
            if (Number.isNaN(this.#current_storage_index) || this.#current_storage_index == this.#storage.length - 1) return undefined;

            return JSON.parse(this.#storage[++this.#current_storage_index])
        }
    }

    const data_history = new History()

    // setTimeout(() => { // Init history
    //     data_history.register_new_data(ComponentRawData.get_raw_data(
    //         participant, history, group, next))
    // }, 0)
    document.addEventListener('keydown', (event) => { // Use history
        if ((event.ctrlKey || event.metaKey)) {
            if (event.key !== 'z' && event.key !== 'y') return;
            end_update_data_event()

            let data: ComponentRawData.Agregation | undefined = undefined
            if (event.key === 'z')
                data = data_history.get_ctrl_z_data()
            else // (event.key === 'y')
                data = data_history.get_ctrl_y_data()

            if (data !== undefined) {
                console.log('⌛➡', data)
                ComponentRawData.set_raw_data(
                    data,
                    participant, history, group, next)
                write_raw_data(data)

                event.stopImmediatePropagation()
                event.preventDefault()
            }
        }
    })


    function save_update_data_event() {
        const raw_data: ComponentRawData.Agregation = ComponentRawData.get_raw_data(
            participant, history, group, next)

        store_raw_data_cookie_and_history(raw_data)
    }
    let update_target: HTMLElement | undefined = undefined
    let update_debounce_timeout: number | undefined = undefined
    let update_max_delay_interval: number | undefined = undefined
    function end_update_data_event() {
        if (update_target === undefined) return;
        update_target.removeEventListener('focusout', end_update_data_event)
        update_target = undefined
        clearTimeout(update_debounce_timeout)
        update_debounce_timeout = undefined
        clearInterval(update_max_delay_interval)
        update_max_delay_interval = undefined
        save_update_data_event()
    }
    function handle_update_data_event(update_data: UpdatedDataDetail) {
        if (update_target === undefined) {
            if (update_data.debounce_timeout_ms !== undefined) {
                update_target = update_data.target
                update_target.addEventListener('focusout', end_update_data_event)
                update_debounce_timeout = setTimeout(() => {
                    update_debounce_timeout = undefined
                    end_update_data_event()
                }, update_data.debounce_timeout_ms)
                if (update_data.max_delay_ms !== undefined)
                    update_max_delay_interval = setInterval(save_update_data_event, update_data.max_delay_ms)
            } else {
                save_update_data_event()
            }
        } else if (update_target == update_data.target) {
            clearTimeout(update_debounce_timeout)
            update_debounce_timeout = undefined

            if (update_data.debounce_timeout_ms !== undefined)
                update_debounce_timeout = setTimeout(() => {
                    update_debounce_timeout = undefined
                    end_update_data_event()
                }, update_data.debounce_timeout_ms)
            else
                end_update_data_event()
        } else if (update_target != update_data.target) {
            end_update_data_event()
            handle_update_data_event(update_data)
        }
    }
    document.addEventListener('update_data_event', (event) => { handle_update_data_event((event as CustomEvent<UpdatedDataDetail>).detail) })
}

namespace Tutorial { // Tutorial or main app
    if (RawData.is_raw_data_stored()) {
        tutorial.style.display = 'none'
        RawData.setup_raw_data_from_stored()
    }
    else
        tab_layout.style.display = 'none';

    export function leave_tutorial() {
        tutorial.style.display = 'none'
        tab_layout.style.display = ''
        tab_layout.classList.add('appear')
    }

    (document.getElementById('start_button') as HTMLButtonElement).onclick = () => {
        tutorial.classList.add('disappear')
        setTimeout(leave_tutorial, 500)
    }
} // namespace Tutorial

{ // Drop file area
    const drop_area: HTMLLabelElement = document.getElementById('file_input_label') as HTMLLabelElement
    const drop_input: HTMLInputElement = drop_area.querySelector('input[type="file"]')!

    drop_area.ondragenter = () => { drop_area.setAttribute('hover_drop', '') }
    drop_area.ondragleave = () => { drop_area.removeAttribute('hover_drop') }
    drop_area.ondragover = drop_area.ondragenter = (event) => { event.preventDefault() }

    drop_area.ondrop = (event) => {
        drop_input.files = event.dataTransfer?.files || null
        event.preventDefault()
        drop_input.dispatchEvent(new Event('change'))
    }

    drop_input.addEventListener('change', () => {
        if (drop_input.files?.length != 1) return;
        const file: File = drop_input.files[0]
        if (!file.name.endsWith('.noel')) return;

        const file_reader = new FileReader()
        file_reader.onload = () => {
            const file_content = file_reader.result as string
            const file_raw_data = JSON.parse(file_content) as ComponentRawData.Agregation
            RawData.set_and_store_raw_data(file_raw_data)
            ComponentRawData.set_raw_data(
                file_raw_data,
                participant, history, group, next)
            Tutorial.leave_tutorial()
        }
        file_reader.readAsText(file, 'utf-8')

        // console.log(`Loading file:`, drop_input.files)
    })
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
